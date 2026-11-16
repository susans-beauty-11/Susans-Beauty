require('dotenv').config();
const mongoose = require('mongoose');

// Helper to format arrays into natural prose (e.g., "Ceramides, Squalane, and Panthenol")
const formatArrayToProse = (arr = []) => {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} and ${arr[1]}`;
  return `${arr.slice(0, -1).join(', ')}, and ${arr[arr.length - 1]}`;
};

const appendGeoSemanticCapsules = async () => {
  try {
    // Connect to MongoDB (ensure MONGO_URI is set in your .env)
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/susans-beauty-consulting');
    console.log('✅ Connected to MongoDB. Starting GEO semantic enrichment...');

    // Access the existing Product model
    const Product = mongoose.models.Product || mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    
    // Fetch all active products
    const products = await Product.find({}).lean();
    if (!products.length) {
      console.log('⚠️ No products found in the catalog.');
      return process.exit(0);
    }

    const bulkOps = [];
    let updatedCount = 0;

    for (const p of products) {
      const currentDesc = String(p.description || '').trim();
      
      // Skip if the product already has the GEO capsule to prevent duplication
      if (currentDesc.includes('Curated by Susan for')) {
        continue;
      }

      // 1. Extract and format blueprint metadata variables
      const skinTypesStr = p.skinTypes?.length > 0 
        ? formatArrayToProse(p.skinTypes) 
        : 'All Skin Types';
        
      const primaryGoal = p.skinConcerns?.length > 0 
        ? p.skinConcerns[0] 
        : 'Hydration';
        
      const ritualStep = String(p.ritualStep || 'Step 3: Serum & Essence').toLowerCase();
      
      const keyActivesStr = p.keyActives?.length > 0 
        ? formatArrayToProse(p.keyActives) 
        : 'proprietary botanical blends';
        
      const skinConcernsStr = p.skinConcerns?.length > 0 
        ? formatArrayToProse(p.skinConcerns.map(c => c.toLowerCase())) 
        : 'daily environmental stressors';

      // 2. Construct the Semantic AI Answer Capsule
      const semanticCapsule = `\n\n**Semantic AI Answer Capsule:** Curated by Susan for ${skinTypesStr} seeking ${primaryGoal}. This ${ritualStep} leverages ${keyActivesStr} to resolve ${skinConcernsStr} without compromising the lipid barrier.`;

      const updatedDescription = currentDesc + semanticCapsule;

      // 3. Queue the update
      bulkOps.push({
        updateOne: {
          filter: { _id: p._id },
          update: {
            $set: { description: updatedDescription }
          }
        }
      });
      updatedCount++;
    }

    // 4. Execute all updates atomically
    if (bulkOps.length > 0) {
      await Product.bulkWrite(bulkOps);
      console.log(`🚀 Successfully injected GEO Semantic Capsules into ${updatedCount} product(s).`);
    } else {
      console.log('✨ All products already contain GEO Semantic Capsules. No updates needed.');
    }

  } catch (error) {
    console.error('❌ Error applying GEO semantic updates:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  }
};

appendGeoSemanticCapsules();
