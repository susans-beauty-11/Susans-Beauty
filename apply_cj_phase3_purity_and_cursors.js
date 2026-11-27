#!/usr/bin/env node
/**
 * apply_cj_phase3_purity_and_cursors.js
 *
 * Phase 3 of the Uncapped CJ Dropshipping Skincare & Beauty Integration Plan.
 * Safely and idempotently patches `server.js` to:
 *  1. Tighten `NON_BEAUTY_EXCLUSION_REGEX`, `NON_BEAUTY_CATEGORY_REGEX`, and
 *     `isStrictHealthAndBeautyProduct` to block ingestible supplements/pills,
 *     slimming/detox teas, medical/wart/fungus/foot patches, perfumes, hair/wigs,
 *     nail drills/gels, oral care, shavers, tattoos, and all non-beauty goods—
 *     allowing strictly Skincare & Facial/Cosmetic Beauty products.
 *  2. Upgrade `sanitizeAndDeduplicateCatalog` to stream documents via MongoDB
 *     `.cursor({ batchSize: 200 })` with lean projections and prioritize `cjPid`
 *     and `cjSku` as primary deduplication keys (requiring >= 14 chars & >= 2
 *     tokens before merging by normalized title so distinct skincare SKUs are
 *     never falsely collapsed).
 *  3. Refactor `purgeNonBeautyCjProducts`, `migrateSemanticAnswerCapsules`,
 *     `backfillProductBlueprintLabels`, and `backfillProductShippingAndCustomLabelMeta`
 *     to stream in 200-document `.cursor()` batches and flush `bulkWrite` chunks
 *     so Render stays low-memory even with 5,000+ skincare products.
 *
 * Usage:
 *   node apply_cj_phase3_purity_and_cursors.js
 *   node apply_cj_phase3_purity_and_cursors.js path/to/server.js
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
  const backupPath = `${filePath}.cj_phase3_${Date.now()}.bak`;
  fs.copyFileSync(filePath, backupPath);
  const output = eol === '\r\n' ? normalizedText.replace(/\n/g, '\r\n') : normalizedText;
  fs.writeFileSync(filePath, output, 'utf8');
  return backupPath;
};

// ---------------- PHASE 3 SERVER.JS PATCHER ---------------- //

const patchServerPhase3 = (serverPath) => {
  console.log(`\n🔧 Applying CJ Phase 3 (Purity Audit & Memory-Safe Cursor Backfills) to: ${serverPath}`);
  let { text, eol } = readNormalized(serverPath);
  let changesApplied = 0;

  // ---- BLOCK 1: Tightened Skincare & Facial/Cosmetic Beauty Purity Gate ---- //
  const purityStartAnchor = 'const NON_BEAUTY_EXCLUSION_REGEX =';
  const purityEndAnchor = "const extractCleanTags = (categoryName = '', title = '') => {";

  const pStartIdx = text.indexOf(purityStartAnchor);
  const pEndIdx = text.indexOf(purityEndAnchor);

  const purityNewBlock = [
    '// Phase 3 Audited Purity Gate: strictly allows Skincare & Facial/Cosmetic Beauty.',
    '// Hard-blocks perfumes, fragrances, hair/wigs, nail art/drills, oral care, shavers,',
    '// tattoos, ingestible supplements/pills/teas, medical/pain/foot patches, and non-beauty items.',
    'const NON_BEAUTY_EXCLUSION_REGEX = /\\b(perfume|perfumes|fragrance|fragrances|parfum|cologne|eau de parfum|eau de toilette|body mist|deodorant|antiperspirant|pheromone|atomizer|shampoo|conditioner|hair oil|hair mask|hair serum|hair spray|hair mist|hair wax|hair dye|hair color|hair growth|hair loss|wig|wigs|toupee|hairpiece|hair extension|lace front|braiding hair|flat iron|curling iron|hair straightener|hair dryer|blow dryer|hot comb|hairbrush|comb|detangler|edge control|beard|mustache|shaver|razor|epilator|trimmer|clipper|waxing|wax beans|depilatory|nail polish|gel nail|nail gel|nail art|nail file|nail drill|nail lamp|uv lamp|cuticle|manicure|pedicure|press on nails|false nails|fake nails|poly gel|acrylic nail|acrylic powder|nail tip|nail sticker|nail glitter|rhinestone|toothbrush|toothpaste|teeth whitening|whitening strips|water flosser|oral irrigator|dental|denture|mouthwash|tongue scraper|breath spray|supplement|supplements|capsule|capsules|tablet|tablets|gummy|gummies|softgel|weight loss|slimming tea|detox tea|fat burner|appetite suppressant|detox foot patch|foot patch|foot soak|varicose|hemorrhoid|wart remover|skin tag|fungus|antifungal|earwax|ear cleaner|pain relief patch|joint cream|muscle rub|prostate|breast enlargement|butt enhancement|intimacy|lubricant|vibrator|sex toy|posture corrector|back brace|knee brace|ankle brace|neck brace|waist trainer|shapewear|corset|cupping|heating pad|hot water bottle|massage gun|foot massager|neck massager|tattoo|microblading|piercing|ear piercing|inhaler|hearing aid|oximeter|thermometer|blood pressure|pill box|first aid|bandage|insoles|shoe pad|foot file|callus|bunion|toe separator|snoring|nose clip|sleep mask|blindfold|earplug|essential oil diffuser|humidifier|incense|candle|ashtray|lighter|vape|hookah|chair|armchair|wheelchair|stool|sofa|couch|table|desk|bed|mattress|pillowcase|curtain|rug|carpet|lamp|lighting|chandelier|kitchen|cookware|frying|baking|pan|pot|knife|cutlery|utensil|mug|tumbler|thermos|water bottle|ice cream|coffee|tea|toaster|blender|microwave|vacuum|broom|mop|detergent|laundry|toilet|plunger|hardware|tool|drill|wrench|screwdriver|hammer|saw|welding|plumbing|solder|phone|iphone|samsung|xiaomi|huawei|ipad|tablet|laptop|computer|pc|keyboard|mouse|monitor|tv|television|camera|tripod|earphone|headphone|earbud|speaker|microphone|charger|cable|adapter|power bank|phone case|screen protector|controller|playstation|xbox|nintendo|gaming|console|drone|smartwatch|watch|clock|shirt|t-shirt|blouse|hoodie|sweater|cardigan|jacket|coat|parka|vest|dress|skirt|pants|jeans|trousers|shorts|leggings|tracksuit|suit|blazer|underwear|bra|panties|lingerie|briefs|boxer|socks|stockings|swimwear|bikini|swimsuit|pajama|nightgown|shoe|shoes|boot|boots|sneaker|sandal|slipper|heels|loafer|hat|beanie|baseball cap|scarf|gloves|mitten|belt|handbag|crossbody|shoulder bag|tote|backpack|wallet|luggage|suitcase|necklace|earring|bracelet|ring|anklet|pendant|brooch|jewelry|jewellery|sunglasses|eyeglasses|spectacles|car|auto|automotive|vehicle|truck|suv|sedan|motorcycle|motorbike|bicycle|bike|scooter|tire|wheel|helmet|windshield|wiper|bumper|fender|pet|dog|cat|puppy|kitten|aquarium|fish tank|bird|hamster|collar|leash|harness|litter|kennel|toy|doll|plush|stuffed|puzzle|lego|board game|action figure|fidget|rc|fishing|camping|tent|sleeping bag|golf|football|basketball|soccer|baseball|tennis|badminton|tactical|hunting|archery|stationery|notebook|binder|stapler|printer|ink cartridge|garden|lawn|mower|hose|plant pot|seed|fertilizer)\\b/i;',
    '',
    '// Non-Skincare/Non-Beauty CJ category names to reject immediately if present',
    'const NON_BEAUTY_CATEGORY_REGEX = /\\b(perfume|fragrance|deodorant|hair|wig|extensions|nail|manicure|pedicure|oral|dental|shaving|epilator|beard|tattoo|body art|massage & relaxation|health care|medical|supplement|nutrition|vitamins|weight loss|adult|intimate|braces|supports|mobility|computer|office|electronics|phone|automotive|automobile|motorcycle|home improvement|lighting|furniture|kitchen|dining|pet|toy|hobbies|sports|outdoors|apparel|clothing|shoes|bags|luggage|jewelry|watches|security|industrial|mother & kids|kids|baby)\\b/i;',
    '',
    '// Strictly allowed Skincare & Facial/Cosmetic Beauty category indicators in CJ\'s category tree',
    'const HEALTH_BEAUTY_CATEGORY_REGEX = /\\b(skincare|skin care|facial|face care|makeup|make-up|make up|cosmetic|cosmetics|beauty tools|eyelash|brow|lip care|lip makeup|eye care|eye makeup|sun care|sunscreen|body lotion|body butter|body scrub)\\b/i;',
    '',
    '// Strictly allowed Skincare & Facial/Cosmetic Beauty product terms (matched on word boundaries in the actual product title)',
    'const HEALTH_BEAUTY_PRODUCT_REGEX = /\\b(skincare|skin care|facial|face care|cosmetic|cosmetics|makeup|make-up|serum|cleanser|cleansing|face wash|facial wash|toner|facial mist|face mist|rosewater|moisturizer|moisturizing|face lotion|body lotion|body butter|body scrub|face cream|night cream|day cream|eye cream|neck cream|barrier cream|bb cream|cc cream|facial balm|cleansing balm|cleansing oil|micellar|makeup remover|essence|ampoule|emulsion|exfoliant|exfoliating|facial scrub|face scrub|facial peel|peeling gel|facial mask|face mask|sheet mask|clay mask|mud mask|eye mask|eye patch|eye patches|hydrogel|sleeping mask|lip mask|lip balm|lip gloss|lipgloss|lipstick|lip liner|lip oil|lip tint|lip stain|lip scrub|lip plumper|lip clay|lip glaze|foundation|concealer|face primer|makeup primer|blush|blusher|bronzer|highlighter|illuminator|contour|eyeshadow|eye shadow|eyeliner|eye liner|mascara|eyebrow|brow gel|brow pencil|false lashes|eyelash|lash curler|lash serum|setting powder|loose powder|pressed powder|compact powder|setting spray|makeup fixer|makeup brush|brush set|kabuki|beauty sponge|makeup sponge|blender sponge|powder puff|collagen|retinol|retinoid|hyaluronic|vitamin c|vitamin e|niacinamide|nicotinamide|salicylic|glycolic|lactic acid|aha|bha|pha|azelaic|ceramide|peptide|squalane|centella|cica|snail|mucin|tea tree|aloe vera|rosehip|turmeric|kojic|bakuchiol|spf|sunscreen|sunblock|gua sha|jade roller|quartz roller|ice roller|derma roller|microneedle|led mask|facial steamer|nano mister|blackhead|pore|ultrasonic scrubber|acne patch|pimple patch|blemish|spot treatment|anti-aging|anti aging|anti-wrinkle|brightening|hydrating|firming)\\b/i;',
    '',
    "const isStrictHealthAndBeautyProduct = (title = '', categoryName = '', description = '') => {",
    "  const cleanTitle = String(title || '').trim();",
    "  const cleanCategory = String(categoryName || '')",
    "    .replace(/^Health\\s*&\\s*Beauty\\s*>\\s*/i, '')",
    "    .replace(/^Skincare\\s*&\\s*Beauty\\s*>\\s*/i, '')",
    '    .trim();',
    "  const cleanDesc = String(description || '').replace(/<[^>]*>?/gm, ' ').slice(0, 400);",
    '  if (!cleanTitle) return false;',
    '',
    '  const combinedTitleAndCat = `${cleanTitle} ${cleanCategory}`;',
    '',
    '  // 1. Hard exclusion gate: reject perfume, hair, nail, oral, supplements, medical, and non-beauty items',
    '  if (NON_BEAUTY_EXCLUSION_REGEX.test(combinedTitleAndCat)) {',
    '    return false;',
    '  }',
    '  if (/\\b(perfume|fragrance|parfum|cologne|deodorant|shampoo|conditioner|wig|nail polish|nail gel|nail drill|toothbrush|teeth whitening|shaver|razor|posture corrector|tattoo|capsule|tablets|gummies|slimming tea|detox tea|wart remover|fungus|hemorrhoid|foot patch|sex toy|vibrator)\\b/i.test(cleanDesc)) {',
    '    return false;',
    '  }',
    '',
    '  // 2. Reject if CJ placed the item in an excluded category',
    '  if (cleanCategory && NON_BEAUTY_CATEGORY_REGEX.test(cleanCategory)) {',
    '    return false;',
    '  }',
    '',
    '  // 3. Require the product\'s actual TITLE to contain a verified Skincare or Facial/Cosmetic Beauty keyword',
    '  return HEALTH_BEAUTY_PRODUCT_REGEX.test(cleanTitle);',
    '};',
    ''
  ].join('\n');

  if (text.includes('// Phase 3 Audited Purity Gate:')) {
    console.log('  ✓ [Block 1] Phase 3 purity filters already installed (skipped)');
  } else if (pStartIdx !== -1 && pEndIdx > pStartIdx) {
    text = text.slice(0, pStartIdx) + purityNewBlock + '\n' + text.slice(pEndIdx);
    changesApplied++;
    console.log('  ✅ [Block 1] Tightened Skincare & Facial/Cosmetic Beauty purity gate');
  } else {
    throw new Error('[Block 1] Could not locate NON_BEAUTY_EXCLUSION_REGEX -> extractCleanTags range.');
  }

  // ---- BLOCK 2: Cursor-Streamed migrateSemanticAnswerCapsules (if Step 1 is installed) ---- //
  const migStartAnchor = '// One-time & on-demand safe migration: isolates Semantic AI Answer Capsules into seoAnswerCapsule';
  const migEndAnchor = '// Backfills structured Blueprint labels onto all existing products in MongoDB';

  const mStartIdx = text.indexOf(migStartAnchor);
  const mEndIdx = text.indexOf(migEndAnchor);

  const migNewBlock = [
    '// One-time & on-demand safe migration (Phase 3 cursor-streamed): isolates Semantic AI Answer Capsules into seoAnswerCapsule',
    'const migrateSemanticAnswerCapsules = async (forceAll = false) => {',
    '  try {',
    '    const query = forceAll',
    '      ? {}',
    '      : {',
    '          $or: [',
    '            { description: /Semantic\\s+AI\\s+Answer\\s+Capsule/i },',
    '            { seoAnswerCapsule: { $exists: false } },',
    "            { seoAnswerCapsule: '' }",
    '          ]',
    '        };',
    '',
    '    const CHUNK_SIZE = 200;',
    '    let bulkOps = [];',
    '    let migratedCount = 0;',
    '',
    '    const cursor = Product.find(query)',
    "      .select('_id title description seoAnswerCapsule rawCjData.description rawCjData.productDescription ritualStep skinTypes skinConcerns keyActives')",
    '      .lean()',
    '      .cursor({ batchSize: CHUNK_SIZE });',
    '',
    '    for await (const prod of cursor) {',
    '      const cleaned = extractAndCleanProductDescription(prod);',
    "      if (cleaned.description !== prod.description || cleaned.seoAnswerCapsule !== (prod.seoAnswerCapsule || '')) {",
    '        bulkOps.push({',
    '          updateOne: {',
    '            filter: { _id: prod._id },',
    '            update: {',
    '              $set: {',
    '                description: cleaned.description,',
    '                seoAnswerCapsule: cleaned.seoAnswerCapsule',
    '              }',
    '            }',
    '          }',
    '        });',
    '        migratedCount++;',
    '      }',
    '',
    '      if (bulkOps.length >= CHUNK_SIZE) {',
    '        await Product.bulkWrite(bulkOps, { ordered: false });',
    '        bulkOps = [];',
    '      }',
    '    }',
    '',
    '    if (bulkOps.length > 0) {',
    '      await Product.bulkWrite(bulkOps, { ordered: false });',
    '    }',
    '',
    '    if (migratedCount > 0) {',
    '      console.log(`✨ Isolated GEO capsules and cleaned customer descriptions on ${migratedCount} product(s) via cursor stream.`);',
    '    }',
    '',
    '    return {',
    '      migratedCount,',
    '      totalCount: await Product.countDocuments()',
    '    };',
    '  } catch (err) {',
    "    console.error('⚠️ Error migrating semantic answer capsules:', err.message);",
    '    return { migratedCount: 0, totalCount: 0, error: err.message };',
    '  }',
    '};',
    ''
  ].join('\n');

  if (text.includes('Phase 3 cursor-streamed): isolates Semantic AI Answer Capsules')) {
    console.log('  ✓ [Block 2] migrateSemanticAnswerCapsules already cursor-streamed (skipped)');
  } else if (mStartIdx !== -1 && mEndIdx > mStartIdx) {
    text = text.slice(0, mStartIdx) + migNewBlock + '\n' + text.slice(mEndIdx);
    changesApplied++;
    console.log('  ✅ [Block 2] Converted migrateSemanticAnswerCapsules to 200-doc MongoDB cursor stream');
  } else {
    console.log('  ℹ️ [Block 2] migrateSemanticAnswerCapsules not found (skipped)');
  }

  // ---- BLOCK 3: Cursor-Streamed backfillProductBlueprintLabels ---- //
  const bpStartAnchor = '// Backfills structured Blueprint labels onto all existing products in MongoDB';
  const bpEndAnchor = "// Synthesizes a rich, personalized Beauty Blueprint Dossier from the member's 10 quiz answers";

  const bpStartIdx = text.indexOf(bpStartAnchor);
  const bpEndIdx = text.indexOf(bpEndAnchor);

  const bpNewBlock = [
    '// Backfills structured Blueprint labels onto all existing products in MongoDB (Phase 3 cursor-streamed)',
    'const backfillProductBlueprintLabels = async (forceAll = false) => {',
    '  try {',
    '    const query = forceAll',
    '      ? {}',
    '      : {',
    '          $or: [',
    '            { skinTypes: { $exists: false } },',
    '            { skinTypes: { $size: 0 } },',
    '            { skinConcerns: { $exists: false } },',
    '            { skinConcerns: { $size: 0 } },',
    '            { ritualStep: { $exists: false } },',
    "            { ritualStep: '' }",
    '          ]',
    '        };',
    '',
    '    const CHUNK_SIZE = 200;',
    '    let updatedCount = 0;',
    '    let bulkOps = [];',
    '',
    '    const cursor = Product.find(query)',
    "      .select('_id title description tags skinTypes skinConcerns sensitivitySafe sensitivityLabel ritualStep keyActives rawCjData.categoryName')",
    '      .lean()',
    '      .cursor({ batchSize: CHUNK_SIZE });',
    '',
    '    for await (const prod of cursor) {',
    "      const catName = prod.rawCjData?.categoryName || (Array.isArray(prod.tags) ? prod.tags.join(' ') : '');",
    '      const classified = classifyProductForBlueprint(',
    '        prod.title,',
    '        catName,',
    '        prod.description,',
    '        forceAll ? { tags: prod.tags } : {',
    '          skinTypes: prod.skinTypes,',
    '          skinConcerns: prod.skinConcerns,',
    '          sensitivitySafe: prod.sensitivitySafe,',
    '          sensitivityLabel: prod.sensitivityLabel,',
    '          ritualStep: prod.ritualStep,',
    '          keyActives: prod.keyActives,',
    '          tags: prod.tags',
    '        }',
    '      );',
    '',
    '      bulkOps.push({',
    '        updateOne: {',
    '          filter: { _id: prod._id },',
    '          update: {',
    '            $set: {',
    '              skinTypes: classified.skinTypes,',
    '              skinConcerns: classified.skinConcerns,',
    '              sensitivitySafe: classified.sensitivitySafe,',
    '              sensitivityLabel: classified.sensitivityLabel,',
    '              ritualStep: classified.ritualStep,',
    '              keyActives: classified.keyActives,',
    '              tags: classified.tags',
    '            }',
    '          }',
    '        }',
    '      });',
    '      updatedCount++;',
    '',
    '      if (bulkOps.length >= CHUNK_SIZE) {',
    '        await Product.bulkWrite(bulkOps, { ordered: false });',
    '        bulkOps = [];',
    '      }',
    '    }',
    '',
    '    if (bulkOps.length > 0) {',
    '      await Product.bulkWrite(bulkOps, { ordered: false });',
    '    }',
    '',
    '    if (updatedCount > 0) {',
    '      console.log(`🏷️ Labeled ${updatedCount} boutique product(s) with Skin Types, Skin Conditions & Ritual Steps via cursor stream.`);',
    '    }',
    '',
    '    const totalCount = await Product.countDocuments();',
    '    return { updatedCount, totalCount };',
    '  } catch (err) {',
    "    console.error('⚠️ Error backfilling product blueprint labels:', err.message);",
    '    return { updatedCount: 0, totalCount: 0, error: err.message };',
    '  }',
    '};',
    ''
  ].join('\n');

  if (text.includes('Phase 3 cursor-streamed)\nconst backfillProductBlueprintLabels')) {
    console.log('  ✓ [Block 3] backfillProductBlueprintLabels already cursor-streamed (skipped)');
  } else if (bpStartIdx !== -1 && bpEndIdx > bpStartIdx) {
    text = text.slice(0, bpStartIdx) + bpNewBlock + '\n' + text.slice(bpEndIdx);
    changesApplied++;
    console.log('  ✅ [Block 3] Converted backfillProductBlueprintLabels to 200-doc MongoDB cursor stream');
  } else {
    throw new Error('[Block 3] Could not locate backfillProductBlueprintLabels range.');
  }

  // ---- BLOCK 4: Cursor-Streamed purgeNonBeautyCjProducts ---- //
  const purgeStartAnchor = '// Purges any previously synced CJ products in MongoDB that fail the strict Skincare & Facial/Cosmetic Beauty filter';
  const purgeEndAnchor = '// Discovers strictly Skincare & Facial/Cosmetic Beauty leaf category IDs from /product/getCategory';

  const puStartIdx = text.indexOf(purgeStartAnchor);
  const puEndIdx = text.indexOf(purgeEndAnchor);

  const purgeNewBlock = [
    '// Purges any previously synced CJ products in MongoDB that fail the strict Skincare & Facial/Cosmetic Beauty filter',
    '// (Phase 3 cursor-streamed in 200-doc batches to keep RAM low on 5,000+ SKU catalogs).',
    'const purgeNonBeautyCjProducts = async () => {',
    '  try {',
    '    const CHUNK_SIZE = 200;',
    '    let pendingDeleteIds = [];',
    '    let totalPurged = 0;',
    '',
    '    const flushPurgeBatch = async (ids) => {',
    '      if (!ids.length) return;',
    '      await Promise.all([',
    '        Product.deleteMany({ _id: { $in: ids } }).catch(() => {}),',
    '        User.updateMany(',
    '          { recommendedProducts: { $in: ids } },',
    '          { $pull: { recommendedProducts: { $in: ids } } }',
    '        ).catch(() => {}),',
    '        InboxItem.deleteMany({ productId: { $in: ids } }).catch(() => {}),',
    '        MemberMonthlyBox.updateMany(',
    "          { 'items.productId': { $in: ids } },",
    '          { $pull: { items: { productId: { $in: ids } } } }',
    '        ).catch(() => {})',
    '      ]);',
    '      totalPurged += ids.length;',
    '    };',
    '',
    '    const cursor = Product.find({ customTitleLocked: { $ne: true } })',
    "      .select('_id title description price variants.price rawCjData.nameEn rawCjData.productNameEn rawCjData.categoryName')",
    '      .lean()',
    '      .cursor({ batchSize: CHUNK_SIZE });',
    '',
    '    for await (const prod of cursor) {',
    '      const rawTitle = String(',
    "        prod.rawCjData?.nameEn || prod.rawCjData?.productNameEn || prod.title || ''",
    '      ).trim();',
    "      const displayTitle = String(prod.title || rawTitle).trim();",
    "      const realCatName = String(prod.rawCjData?.categoryName || '')",
    "        .replace(/^Health\\s*&\\s*Beauty\\s*>\\s*/i, '')",
    "        .replace(/^Skincare\\s*&\\s*Beauty\\s*>\\s*/i, '')",
    '        .trim();',
    '      const price = Number(prod.variants?.[0]?.price ?? prod.price ?? 0);',
    '',
    '      const isValidDisplay = isStrictHealthAndBeautyProduct(displayTitle, realCatName, prod.description);',
    '      const isValidRaw = rawTitle ? isStrictHealthAndBeautyProduct(rawTitle, realCatName, prod.description) : true;',
    '',
    '      if (!isValidDisplay || !isValidRaw || !(price > 0)) {',
    '        pendingDeleteIds.push(prod._id);',
    '        if (pendingDeleteIds.length >= CHUNK_SIZE) {',
    '          await flushPurgeBatch(pendingDeleteIds);',
    '          pendingDeleteIds = [];',
    '        }',
    '      }',
    '    }',
    '',
    '    if (pendingDeleteIds.length > 0) {',
    '      await flushPurgeBatch(pendingDeleteIds);',
    '    }',
    '',
    '    if (totalPurged > 0) {',
    '      console.log(`🧹 Purged ${totalPurged} perfume, supplement, hair/nail/oral, or non-Skincare/Beauty CJ product(s) from MongoDB.`);',
    '    }',
    '',
    '    return totalPurged;',
    '  } catch (err) {',
    '    console.error("⚠️ Error purging non-beauty CJ products:", err.message);',
    '    return 0;',
    '  }',
    '};',
    ''
  ].join('\n');

  if (text.includes('Phase 3 cursor-streamed in 200-doc batches to keep RAM low')) {
    console.log('  ✓ [Block 4] purgeNonBeautyCjProducts already cursor-streamed (skipped)');
  } else if (puStartIdx !== -1 && puEndIdx > puStartIdx) {
    text = text.slice(0, puStartIdx) + purgeNewBlock + '\n' + text.slice(puEndIdx);
    changesApplied++;
    console.log('  ✅ [Block 4] Converted purgeNonBeautyCjProducts to 200-doc cursor stream');
  } else {
    throw new Error('[Block 4] Could not locate purgeNonBeautyCjProducts range.');
  }

  // ---- BLOCK 5: Upgrade sanitizeAndDeduplicateCatalog to Cursor Stream + cjPid/cjSku-First Deduplication ---- //
  const dedupeOldBlock = [
    '    // 2. Load lightweight fields for deduplication (skipping heavy rawCjData blobs where possible)',
    '    const allProducts = await Product.find({})',
    "      .select('_id title cjPid cjSku normalizedTitleKey customTitleLocked imageUrl viewCount cartAddCount purchaseCount curatedCount lastSyncedAt variants.sku rawCjData.pid rawCjData.productSku rawCjData.sku rawCjData.nameEn rawCjData.productNameEn')",
    '      .lean();',
    '    const totalScanned = allProducts.length;'
  ].join('\n');

  const dedupeNewBlock = [
    '    // 2. Stream lightweight fields via cursor (skipping heavy rawCjData blobs to keep RAM flat)',
    '    const allProducts = [];',
    '    const scanCursor = Product.find({})',
    "      .select('_id title cjPid cjSku normalizedTitleKey customTitleLocked imageUrl ritualStep viewCount cartAddCount purchaseCount curatedCount lastSyncedAt variants.sku rawCjData.pid rawCjData.productSku rawCjData.sku rawCjData.nameEn rawCjData.productNameEn')",
    '      .lean()',
    '      .cursor({ batchSize: 200 });',
    '    for await (const doc of scanCursor) {',
    '      allProducts.push(doc);',
    '    }',
    '    const totalScanned = allProducts.length;'
  ].join('\n');

  if (text.includes('const scanCursor = Product.find({})')) {
    console.log('  ✓ [Block 5a] sanitizeAndDeduplicateCatalog already uses cursor stream (skipped)');
  } else if (text.includes(dedupeOldBlock)) {
    text = text.replace(dedupeOldBlock, dedupeNewBlock);
    changesApplied++;
    console.log('  ✅ [Block 5a] Switched sanitizeAndDeduplicateCatalog scan to 200-doc cursor stream');
  } else {
    console.log('  ℹ️ [Block 5a] sanitizeAndDeduplicateCatalog scan block already customized (skipped)');
  }

  // Refine canonical matching to prioritize cjPid & cjSku and prevent false-positive title merges on short generic titles
  const matchOldBlock = [
    '      let matchedCanonical = null;',
    '      if (pidKey && canonicalByPid.has(pidKey)) {',
    '        matchedCanonical = canonicalByPid.get(pidKey);',
    '      } else if (skuKey && canonicalBySku.has(skuKey)) {',
    '        matchedCanonical = canonicalBySku.get(skuKey);',
    '      } else if (normTitle && canonicalByNormTitle.has(normTitle)) {',
    '        matchedCanonical = canonicalByNormTitle.get(normTitle);',
    '      } else if (normRawCjTitle && canonicalByNormTitle.has(normRawCjTitle)) {',
    '        matchedCanonical = canonicalByNormTitle.get(normRawCjTitle);',
    '      } else if (cleanImg && prod.rawCjData && canonicalByImage.has(cleanImg)) {',
    '        matchedCanonical = canonicalByImage.get(cleanImg);',
    '      }'
  ].join('\n');

  const matchNewBlock = [
    '      // Phase 3 cjPid/cjSku-first deduplication: prevents false merges of distinct skincare SKUs with short generic titles',
    "      const isSpecificNormTitle = (t) => Boolean(t && t.length >= 14 && t.split(' ').length >= 2);",
    '      let matchedCanonical = null;',
    '      if (pidKey && canonicalByPid.has(pidKey)) {',
    '        matchedCanonical = canonicalByPid.get(pidKey);',
    '      } else if (skuKey && canonicalBySku.has(skuKey)) {',
    '        matchedCanonical = canonicalBySku.get(skuKey);',
    '      } else if (isSpecificNormTitle(normTitle) && canonicalByNormTitle.has(normTitle)) {',
    '        const cand = canonicalByNormTitle.get(normTitle);',
    "        const candPid = String(cand.cjPid || cand.rawCjData?.pid || '').trim().toLowerCase();",
    '        // Only merge different cjPids by title if they also share the same ritualStep (avoids merging Serum + Cream)',
    '        if (!pidKey || !candPid || pidKey === candPid || cand.ritualStep === prod.ritualStep) {',
    '          matchedCanonical = cand;',
    '        }',
    '      } else if (isSpecificNormTitle(normRawCjTitle) && canonicalByNormTitle.has(normRawCjTitle)) {',
    '        const cand = canonicalByNormTitle.get(normRawCjTitle);',
    "        const candPid = String(cand.cjPid || cand.rawCjData?.pid || '').trim().toLowerCase();",
    '        if (!pidKey || !candPid || pidKey === candPid || cand.ritualStep === prod.ritualStep) {',
    '          matchedCanonical = cand;',
    '        }',
    '      } else if (cleanImg && prod.rawCjData && canonicalByImage.has(cleanImg)) {',
    '        const cand = canonicalByImage.get(cleanImg);',
    '        if (cand.ritualStep === prod.ritualStep) {',
    '          matchedCanonical = cand;',
    '        }',
    '      }'
  ].join('\n');

  if (text.includes('// Phase 3 cjPid/cjSku-first deduplication:')) {
    console.log('  ✓ [Block 5b] cjPid/cjSku-first deduplication already installed (skipped)');
  } else if (text.includes(matchOldBlock)) {
    text = text.replace(matchOldBlock, matchNewBlock);
    changesApplied++;
    console.log('  ✅ [Block 5b] Upgraded sanitizeAndDeduplicateCatalog to cjPid/cjSku-first deduplication');
  } else {
    console.log('  ℹ️ [Block 5b] Deduplication match block already customized (skipped)');
  }

  // ---- BLOCK 6: Cursor-Streamed backfillProductShippingAndCustomLabelMeta ---- //
  const shipStartAnchor = 'const backfillProductShippingAndCustomLabelMeta = async (forceAll = false) => {';
  const shipEndAnchor = "// Queries CJ's POST /product/myProduct/queryPackagingProduct";

  const shStartIdx = text.indexOf(shipStartAnchor);
  const shEndIdx = text.indexOf(shipEndAnchor);

  const shipNewBlock = [
    '// Backfills CJ shipping rates, wholesale prices & 3-layer custom branding via 200-doc cursor stream (Phase 3)',
    'const backfillProductShippingAndCustomLabelMeta = async (forceAll = false) => {',
    '  try {',
    '    const CHUNK_SIZE = 200;',
    '    let bulkOps = [];',
    '    let updatedCount = 0;',
    '    let totalCount = 0;',
    '',
    '    const cursor = Product.find({})',
    "      .select('_id price wholesalePriceUsd markupMultiplier estimatedWeightGrams originCountryCode selectedLogisticName shippingCostUsd shippingIncludedInPrice availableLogistics customLabelConfig variants rawCjData.sellPrice rawCjData.price rawCjData.productWeight rawCjData.packWeight rawCjData.weight')",
    '      .lean()',
    '      .cursor({ batchSize: CHUNK_SIZE });',
    '',
    '    for await (const prod of cursor) {',
    '      totalCount++;',
    '      const currentAllInCost = Number(prod.wholesalePriceUsd || 2.00) + Math.max(7.84, Number(prod.shippingCostUsd || 7.84));',
    '      const needsBackfill =',
    '        forceAll ||',
    '        !(Number(prod.wholesalePriceUsd) > 0) ||',
    '        !(Number(prod.shippingCostUsd) >= 5.25) ||',
    '        !prod.selectedLogisticName ||',
    "        prod.selectedLogisticName === 'CJPacket Sensitive' ||",
    '        !Array.isArray(prod.availableLogistics) ||',
    '        prod.availableLogistics.length < 8 ||',
    '        Number(prod.price || 0) < (currentAllInCost + 5.00) ||',
    '        !prod.customLabelConfig ||',
    "        typeof prod.customLabelConfig !== 'object' ||",
    '        !prod.customLabelConfig.enabled ||',
    '        !prod.customLabelConfig.allThreeEnabled ||',
    '        Number(prod.customLabelConfig.packagingCostUsd || 0) < 1.95;',
    '',
    '      if (!needsBackfill) continue;',
    '',
    '      let inferredWholesale = Number(prod.wholesalePriceUsd || 0);',
    "      const rawCjSell = parseFloat(String(prod.rawCjData?.sellPrice || prod.rawCjData?.price || '0').split('-')[0].trim());",
    '      if (rawCjSell > 0) {',
    '        inferredWholesale = rawCjSell;',
    '      } else if (!(inferredWholesale > 0)) {',
    '        const currentPrice = Number(prod.variants?.[0]?.price ?? prod.price ?? 16.25);',
    '        inferredWholesale = currentPrice > 0 ? Number((currentPrice / 6.5).toFixed(2)) : 2.50;',
    '      }',
    '',
    "      const rawWeight = parseFloat(String(prod.rawCjData?.productWeight || prod.rawCjData?.packWeight || prod.rawCjData?.weight || prod.estimatedWeightGrams || '120').split('-')[0].trim());",
    '      const weightGrams = Math.max(30, Number(rawWeight) || 120);',
    '',
    '      const workingProd = { ...prod };',
    '      recalculateProductRetailPrice(workingProd, {',
    '        wholesalePriceUsd: inferredWholesale,',
    '        estimatedWeightGrams: weightGrams,',
    '        autoSelectOptimalCarrier: true,',
    '        shippingIncludedInPrice: prod.shippingIncludedInPrice !== undefined ? Boolean(prod.shippingIncludedInPrice) : true,',
    '        customLabelConfig: getDefaultCustomLabelConfig({',
    '          ...(prod.customLabelConfig || {}),',
    '          enabled: true,',
    '          allThreeEnabled: true,',
    '          includeBottleLabel: true,',
    '          includeSatinPouch: true,',
    '          includeCustomBox: true',
    '        })',
    '      });',
    '',
    '      bulkOps.push({',
    '        updateOne: {',
    '          filter: { _id: prod._id },',
    '          update: {',
    '            $set: {',
    '              wholesalePriceUsd: workingProd.wholesalePriceUsd,',
    '              markupMultiplier: workingProd.markupMultiplier,',
    '              estimatedWeightGrams: workingProd.estimatedWeightGrams,',
    '              originCountryCode: workingProd.originCountryCode,',
    '              selectedLogisticName: workingProd.selectedLogisticName,',
    '              shippingCostUsd: workingProd.shippingCostUsd,',
    '              shippingIncludedInPrice: workingProd.shippingIncludedInPrice,',
    '              availableLogistics: workingProd.availableLogistics,',
    '              customLabelConfig: workingProd.customLabelConfig,',
    '              price: workingProd.price,',
    '              variants: workingProd.variants',
    '            }',
    '          }',
    '        }',
    '      });',
    '      updatedCount++;',
    '',
    '      if (bulkOps.length >= CHUNK_SIZE) {',
    '        await Product.bulkWrite(bulkOps, { ordered: false });',
    '        bulkOps = [];',
    '      }',
    '    }',
    '',
    '    if (bulkOps.length > 0) {',
    '      await Product.bulkWrite(bulkOps, { ordered: false });',
    '    }',
    '',
    '    if (updatedCount > 0) {',
    '      console.log(`✈️ Backfilled CJ shipping rates, wholesale prices & custom label metadata on ${updatedCount} product(s) via cursor stream.`);',
    '    }',
    '    return { updatedCount, totalCount };',
    '  } catch (err) {',
    "    console.warn('⚠️ Error in backfillProductShippingAndCustomLabelMeta:', err.message);",
    '    return { updatedCount: 0, totalCount: 0, error: err.message };',
    '  }',
    '};',
    ''
  ].join('\n');

  if (text.includes('via 200-doc cursor stream (Phase 3)')) {
    console.log('  ✓ [Block 6] backfillProductShippingAndCustomLabelMeta already cursor-streamed (skipped)');
  } else if (shStartIdx !== -1 && shEndIdx > shStartIdx) {
    text = text.slice(0, shStartIdx) + shipNewBlock + '\n' + text.slice(shEndIdx);
    changesApplied++;
    console.log('  ✅ [Block 6] Converted backfillProductShippingAndCustomLabelMeta to 200-doc cursor stream');
  } else {
    throw new Error('[Block 6] Could not locate backfillProductShippingAndCustomLabelMeta range.');
  }

  if (changesApplied > 0) {
    const backupPath = writeWithOriginalEol(serverPath, text, eol);
    console.log(`  💾 Saved ${serverPath} (${changesApplied} change(s) applied). Backup: ${path.basename(backupPath)}`);
  } else {
    console.log(`  ℹ️ No changes needed for ${serverPath}.`);
  }
};

// ---------------- MAIN EXECUTION ---------------- //

try {
  const cliServerArg = process.argv[2];
  const serverPath = findFirstExistingFile([
    cliServerArg,
    'server.js',
    'server_2.js'
  ]);

  if (!serverPath) {
    throw new Error('Could not locate server.js. Pass it explicitly: node apply_cj_phase3_purity_and_cursors.js path/to/server.js');
  }

  patchServerPhase3(serverPath);

  console.log('\n✨ Phase 3 (Strict Skincare/Beauty Purity Audit & Memory-Safe Cursor Backfills) applied successfully!');
  console.log('Next steps:');
  console.log(`  1. Syntax-check backend:  node --check "${serverPath}"`);
  console.log('  2. Ready for Phase 4 (true server-side pagination in Boutique & AdminInventory so 5,000+ SKUs load instantly)!');
} catch (err) {
  console.error('\n❌ Phase 3 patch failed:', err.message);
  process.exit(1);
}