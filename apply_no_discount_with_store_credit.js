#!/usr/bin/env node
/**
 * apply_no_discount_with_store_credit.js
 *
 * Enforces the rule: customers cannot combine their membership discount
 * (10% / 15% / 25%) on any order where they apply their promo Store Credit.
 *
 * Changes applied:
 *  Part A — server.js (`POST /api/cart-checkout`):
 *    1. Captures the authenticated member's `storeCreditBalance` before
 *       computing item discounts.
 *    2. When `applyStoreCredit !== false` and `storeCreditBalance > 0`,
 *       sets the membership discount rate to `0` so items are priced at full
 *       retail before the 1:1 Store Credit match is applied.
 *    3. If the customer unchecks Store Credit (`applyStoreCredit: false`) or
 *       has `$0.00` credit remaining, their normal membership discount applies.
 *
 *  Part B — App.js (`calculateCartTotal` & Ritual Bag Drawer):
 *    1. Sets the active membership discount rate to `0` in `calculateCartTotal`
 *       and the Ritual Bag summary whenever Store Credit is checked and > $0.
 *    2. Displays a clear note in the Ritual Bag explaining that membership
 *       discounts do not combine with Store Credit (and that unchecking Store
 *       Credit re-enables the membership discount).
 *
 * Usage:
 *   node apply_no_discount_with_store_credit.js
 *   node apply_no_discount_with_store_credit.js path/to/server.js path/to/App.js
 */

const fs = require('fs');
const path = require('path');

// ---------------- FILE DISCOVERY & IO HELPERS ---------------- //

const findFirstExistingFile = (candidates = []) => {
  for (const relPath of candidates) {
    if (!relPath) continue;
    const resolved = path.resolve(process.cwd(), relPath);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return resolved;
    }
  }
  return null;
};

const readNormalized = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return {
    text: raw.replace(/\r\n/g, '\n'),
    eol
  };
};

const writeWithOriginalEol = (filePath, normalizedText, eol) => {
  const backupPath = `${filePath}.no_stack_credit_${Date.now()}.bak`;
  fs.copyFileSync(filePath, backupPath);
  const output = eol === '\r\n' ? normalizedText.replace(/\n/g, '\r\n') : normalizedText;
  fs.writeFileSync(filePath, output, 'utf8');
  return backupPath;
};

// ---------------- PART A: SERVER.JS PATCHER ---------------- //

const patchServerNoStacking = (serverPath) => {
  console.log(`\n🔧 Patching /api/cart-checkout store-credit rule in: ${serverPath}`);
  let { text, eol } = readNormalized(serverPath);
  let changesApplied = 0;

  // 1. Capture verifiedDbUser during token lookup and disable member discount when using Store Credit
  const oldAuthAndDiscountBlock = [
    "    let verifiedTier = String(membershipTier || '').toLowerCase().trim();",
    '    let verifiedEmail = normalizeEmail(customerEmail);',
    '    let verifiedUserId = null;',
    '    let fallbackUserShipping = null;',
    '',
    "    const authHeader = req.headers['authorization'];",
    "    const token = authHeader && authHeader.split(' ')[1];",
    '    if (token) {',
    '      try {',
    "        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');",
    "        const dbUser = await User.findById(decoded._id).select('_id name email membershipTier shippingAddress isFoundingMember storeCreditBalance pendingVipMysteryBox').lean();",
    '        if (dbUser) {',
    '          verifiedUserId = dbUser._id;',
    "          verifiedTier = String(dbUser.membershipTier || verifiedTier).toLowerCase().trim();",
    '          if (!verifiedEmail && dbUser.email) {',
    '            verifiedEmail = normalizeEmail(dbUser.email);',
    '          }',
    '          if (dbUser.shippingAddress && dbUser.shippingAddress.address_1) {',
    '            fallbackUserShipping = dbUser.shippingAddress;',
    '          }',
    '        }',
    '      } catch (tokenErr) {',
    '        // Proceed as guest/fallback tier if token is expired or absent',
    '      }',
    '    }',
    '',
    '    const discountInfo = getMemberDiscountInfo(verifiedTier);',
    '    const multiplier = 1 - discountInfo.rate;'
  ].join('\n');

  const newAuthAndDiscountBlock = [
    "    let verifiedTier = String(membershipTier || '').toLowerCase().trim();",
    '    let verifiedEmail = normalizeEmail(customerEmail);',
    '    let verifiedUserId = null;',
    '    let verifiedDbUser = null;',
    '    let fallbackUserShipping = null;',
    '',
    "    const authHeader = req.headers['authorization'];",
    "    const token = authHeader && authHeader.split(' ')[1];",
    '    if (token) {',
    '      try {',
    "        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key');",
    "        const dbUser = await User.findById(decoded._id).select('_id name email membershipTier shippingAddress isFoundingMember storeCreditBalance pendingVipMysteryBox').lean();",
    '        if (dbUser) {',
    '          verifiedUserId = dbUser._id;',
    '          verifiedDbUser = dbUser;',
    "          verifiedTier = String(dbUser.membershipTier || verifiedTier).toLowerCase().trim();",
    '          if (!verifiedEmail && dbUser.email) {',
    '            verifiedEmail = normalizeEmail(dbUser.email);',
    '          }',
    '          if (dbUser.shippingAddress && dbUser.shippingAddress.address_1) {',
    '            fallbackUserShipping = dbUser.shippingAddress;',
    '          }',
    '        }',
    '      } catch (tokenErr) {',
    '        // Proceed as guest/fallback tier if token is expired or absent',
    '      }',
    '    }',
    '',
    '    // Enforce no-stacking rule: membership discount is disabled on any order applying Store Credit',
    '    const applyStoreCreditFlag = req.body?.applyStoreCredit !== false;',
    '    const hasUsableStoreCredit = Boolean(',
    '      applyStoreCreditFlag &&',
    '      verifiedDbUser &&',
    '      Number(verifiedDbUser.storeCreditBalance || 0) > 0',
    '    );',
    '    const rawDiscountInfo = getMemberDiscountInfo(verifiedTier);',
    '    const discountInfo = hasUsableStoreCredit',
    "      ? { rate: 0, label: '' }",
    '      : rawDiscountInfo;',
    '    const memberDiscountWaivedForCredit = Boolean(hasUsableStoreCredit && rawDiscountInfo.rate > 0);',
    '    const multiplier = 1 - discountInfo.rate;'
  ].join('\n');

  if (text.includes('const memberDiscountWaivedForCredit = Boolean(hasUsableStoreCredit')) {
    console.log('  ✓ [A.1] /api/cart-checkout no-stacking discount guard already present (skipped)');
  } else if (text.includes(oldAuthAndDiscountBlock)) {
    text = text.replace(oldAuthAndDiscountBlock, newAuthAndDiscountBlock);
    changesApplied++;
    console.log('  ✅ [A.1] Disabled membership discount in /api/cart-checkout when Store Credit is applied');
  } else {
    throw new Error('[A.1] Could not find /api/cart-checkout auth & discountInfo block in server.js.');
  }

  // 2. Remove duplicate `const applyStoreCreditFlag` declaration later in /api/cart-checkout and reuse verifiedDbUser
  const oldCreditBlock = [
    '    const applyStoreCreditFlag = req.body?.applyStoreCredit !== false;',
    '    let foundingUserDoc = verifiedUserId ? await User.findById(verifiedUserId).lean().catch(() => null) : null;'
  ].join('\n');

  const newCreditBlock = [
    '    const foundingUserDoc = verifiedDbUser || (verifiedUserId ? await User.findById(verifiedUserId).lean().catch(() => null) : null);'
  ].join('\n');

  if (text.includes('const foundingUserDoc = verifiedDbUser ||')) {
    console.log('  ✓ [A.2] foundingUserDoc already reuses verifiedDbUser (skipped)');
  } else if (text.includes(oldCreditBlock)) {
    text = text.replace(oldCreditBlock, newCreditBlock);
    changesApplied++;
    console.log('  ✅ [A.2] Deduplicated applyStoreCreditFlag and reused verifiedDbUser');
  } else {
    throw new Error('[A.2] Could not find duplicate applyStoreCreditFlag / foundingUserDoc lines in /api/cart-checkout.');
  }

  // 3. Expose memberDiscountWaivedForCredit in /api/cart-checkout JSON response
  const oldRespLine = '      discountLabel: discountInfo.label,';
  const newRespLine = [
    '      discountLabel: discountInfo.label,',
    '      memberDiscountWaivedForCredit,'
  ].join('\n');

  if (text.includes('      memberDiscountWaivedForCredit,')) {
    console.log('  ✓ [A.3] memberDiscountWaivedForCredit already returned in response (skipped)');
  } else if (text.includes(oldRespLine)) {
    text = text.replace(oldRespLine, newRespLine);
    changesApplied++;
    console.log('  ✅ [A.3] Added memberDiscountWaivedForCredit to /api/cart-checkout response');
  }

  if (changesApplied > 0) {
    const backupPath = writeWithOriginalEol(serverPath, text, eol);
    console.log(`  💾 Saved ${serverPath} (${changesApplied} change(s) applied). Backup: ${path.basename(backupPath)}`);
  } else {
    console.log(`  ℹ️ No changes needed for ${serverPath}.`);
  }
};

// ---------------- PART B: APP.JS PATCHER ---------------- //

const patchAppNoStacking = (appPath) => {
  console.log(`\n🔧 Patching Ritual Bag store-credit rule in: ${appPath}`);
  let { text, eol } = readNormalized(appPath);
  let changesApplied = 0;

  // 1. Update calculateCartTotal() so membership discount rate is 0 when Store Credit is enabled and > $0
  const oldCalcTotal = [
    '  // Member discounts (10%/25%) apply ONLY to the product portion — never discounting the CJ shipping cost!',
    '  const calculateCartTotal = () => {',
    '    const { rate } = getActiveMemberDiscount();'
  ].join('\n');

  const newCalcTotal = [
    '  // Member discounts (10%/15%/25%) apply ONLY to the product portion — and NEVER stack on orders using Store Credit',
    '  const calculateCartTotal = () => {',
    '    const isUsingStoreCredit = Boolean(applyStoreCreditInBag && Number(userDetails?.storeCreditBalance || 0) > 0 && cart.length > 0);',
    '    const { rate: rawRate } = getActiveMemberDiscount();',
    '    const rate = isUsingStoreCredit ? 0 : rawRate;'
  ].join('\n');

  if (text.includes('const rate = isUsingStoreCredit ? 0 : rawRate;')) {
    console.log('  ✓ [B.1] calculateCartTotal already skips membership discount when using Store Credit (skipped)');
  } else if (text.includes(oldCalcTotal)) {
    text = text.replace(oldCalcTotal, newCalcTotal);
    changesApplied++;
    console.log('  ✅ [B.1] Updated calculateCartTotal to waive membership discount when Store Credit is active');
  } else {
    throw new Error('[B.1] Could not find calculateCartTotal anchor in App.js.');
  }

  // 2. Update Ritual Bag Drawer calculation & show transparent non-stacking notice
  const oldDrawerMath = [
    '              const subtotal = calculateCartSubtotal();',
    '              const { rate, label } = getActiveMemberDiscount();',
    '              const discountAmount = subtotal * rate;',
    '              const postDiscountTotal = Number(calculateCartTotal()) || 0;',
    '              const foundingPreview = computeClientSideFoundingBreakdown(',
    '                cart.map(it => ({ ...it, price: Number(it.price || 0) })),',
    '                userDetails,',
    '                applyStoreCreditInBag',
    '              );',
    '              const availableVaultCredit = Number(userDetails?.storeCreditBalance || 0);'
  ].join('\n');

  const newDrawerMath = [
    '              const subtotal = calculateCartSubtotal();',
    '              const availableVaultCredit = Number(userDetails?.storeCreditBalance || 0);',
    '              const isUsingStoreCredit = Boolean(applyStoreCreditInBag && availableVaultCredit > 0 && cart.length > 0);',
    '              const rawMemberDiscount = getActiveMemberDiscount();',
    '              const rate = isUsingStoreCredit ? 0 : rawMemberDiscount.rate;',
    "              const label = isUsingStoreCredit ? '' : rawMemberDiscount.label;",
    '              const memberDiscountWaivedForCredit = Boolean(isUsingStoreCredit && rawMemberDiscount.rate > 0);',
    '              const discountAmount = subtotal * rate;',
    '              const postDiscountTotal = Number(calculateCartTotal()) || 0;',
    '              const foundingPreview = computeClientSideFoundingBreakdown(',
    '                cart.map(it => ({ ...it, price: Number(it.price || 0) })),',
    '                userDetails,',
    '                applyStoreCreditInBag',
    '              );'
  ].join('\n');

  if (text.includes('const memberDiscountWaivedForCredit = Boolean(isUsingStoreCredit && rawMemberDiscount.rate > 0);')) {
    console.log('  ✓ [B.2a] Ritual Bag drawer math already enforces no-stacking rule (skipped)');
  } else if (text.includes(oldDrawerMath)) {
    text = text.replace(oldDrawerMath, newDrawerMath);
    changesApplied++;
    console.log('  ✅ [B.2a] Updated Ritual Bag drawer math to waive membership discount when Store Credit is applied');
  } else {
    throw new Error('[B.2a] Could not find Ritual Bag drawer math anchor in App.js.');
  }

  const oldVaultNote = [
    "                      <div style={{ fontSize: '0.7rem', color: '#4A6B4D', lineHeight: '1.35' }}>",
    '                        Up to 50% of cart matched with Store Credit. Remaining Vault: <strong>${remainingVaultUsd.toFixed(2)}</strong>',
    '                      </div>'
  ].join('\n');

  const newVaultNote = [
    "                      <div style={{ fontSize: '0.7rem', color: '#4A6B4D', lineHeight: '1.35' }}>",
    '                        Up to 50% of cart matched with Store Credit. Remaining Vault: <strong>${remainingVaultUsd.toFixed(2)}</strong>',
    '                      </div>',
    '                      {memberDiscountWaivedForCredit && (',
    "                        <div style={{ fontSize: '0.68rem', color: '#8A5A00', marginTop: '4px', lineHeight: '1.35' }}>",
    '                          ℹ️ Membership discount ({Math.round(rawMemberDiscount.rate * 100)}%) is not combined on orders using Store Credit. Uncheck above to use your membership discount instead.',
    '                        </div>',
    '                      )}'
  ].join('\n');

  if (text.includes('Membership discount ({Math.round(rawMemberDiscount.rate * 100)}%) is not combined on orders using Store Credit.')) {
    console.log('  ✓ [B.2b] Ritual Bag non-stacking notice already present (skipped)');
  } else if (text.includes(oldVaultNote)) {
    text = text.replace(oldVaultNote, newVaultNote);
    changesApplied++;
    console.log('  ✅ [B.2b] Added clear non-stacking notice inside the Ritual Bag Store Credit box');
  } else {
    throw new Error('[B.2b] Could not find Ritual Bag Store Credit note anchor in App.js.');
  }

  if (changesApplied > 0) {
    const backupPath = writeWithOriginalEol(appPath, text, eol);
    console.log(`  💾 Saved ${appPath} (${changesApplied} change(s) applied). Backup: ${path.basename(backupPath)}`);
  } else {
    console.log(`  ℹ️ No changes needed for ${appPath}.`);
  }
};

// ---------------- MAIN EXECUTION ---------------- //

try {
  const cliServerArg = process.argv[2];
  const cliAppArg = process.argv[3];

  const serverPath = findFirstExistingFile([
    cliServerArg,
    'server.js',
    'server_2.js'
  ]);

  const appPath = findFirstExistingFile([
    cliAppArg,
    'client/src/App.js',
    'src/App.js',
    'App.js',
    'App_2.js'
  ]);

  if (!serverPath) {
    throw new Error('Could not locate server.js. Pass it explicitly: node apply_no_discount_with_store_credit.js path/to/server.js path/to/App.js');
  }
  if (!appPath) {
    throw new Error('Could not locate App.js. Pass it explicitly: node apply_no_discount_with_store_credit.js path/to/server.js path/to/App.js');
  }

  patchServerNoStacking(serverPath);
  patchAppNoStacking(appPath);

  console.log('\n✨ Store Credit vs. Membership Discount no-stacking rule applied successfully!');
  console.log('Next steps:');
  console.log(`  1. Syntax-check backend:  node --check "${serverPath}"`);
  console.log('  2. Build React frontend:  cd client && npm run build');
  console.log('  3. Commit & push, then test in the Ritual Bag:');
  console.log('     - With "Apply Store Credit (1:1 Match)" checked: full retail price is used, Store Credit applies 1:1, and membership discount is waived.');
  console.log('     - With "Apply Store Credit" unchecked (or $0 balance): normal membership discount (10% / 15% / 25%) applies.');
} catch (err) {
  console.error('\n❌ Patch failed:', err.message);
  process.exit(1);
}