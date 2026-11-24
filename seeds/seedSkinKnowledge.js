require("dotenv").config();
const mongoose = require("mongoose");
const { Concern, Ingredient } = require("../models/SkinKnowledge");

const SEED_CONCERNS = [
  {
    slug: "skin-barrier-repair",
    title: "Skin Barrier Repair",
    answerCapsule:
      "A compromised skin barrier often shows up as tightness, stinging, flaking, redness, or sudden sensitivity. Restoring it starts with pausing harsh exfoliants, using a gentle non-stripping cleanser, and layering barrier-supporting humectants and moisturizers consistently.",
    overview:
      "The outermost layer of your skin (the stratum corneum) protects against moisture loss and outside irritants. Over-exfoliating, dry weather, or harsh cleansers can leave skin feeling reactive and dehydrated.",
    commonTriggers: [
      "Overusing strong acids or retinoids without recovery days",
      "Hot water or foaming cleansers that strip natural oils",
      "Dry indoor air, wind, or skipping daily sunscreen"
    ],
    routineGuidance: {
      amSteps: [
        "Rinse or cleanse gently with lukewarm water",
        "Apply a hydrating or barrier-calming serum on slightly damp skin",
        "Seal with a nourishing moisturizer and broad-spectrum SPF"
      ],
      pmSteps: [
        "Cleanse gently without harsh scrubbing",
        "Apply a soothing barrier serum or cream",
        "Lock in hydration with a rich moisturizer"
      ],
      avoidList: [
        "Physical scrubs and multiple exfoliating acids at once",
        "Fragrance-heavy or drying treatments until stinging stops"
      ]
    },
    recommendedIngredientSlugs: ["niacinamide", "hyaluronic-acid"],
    relatedProductSlugs: [],
    faqs: [
      {
        question: "How long does it take to repair a damaged skin barrier?",
        answer: "Mild irritation often improves within a few days to two weeks of keeping your routine simple and consistent, while deeper barrier recovery can take three to four weeks."
      },
      {
        question: "Should I stop all active ingredients while repairing my barrier?",
        answer: "Yes—pause exfoliating acids, retinoids, and strong treatments until redness, tightness, and stinging settle down, then reintroduce actives slowly."
      }
    ],
    authoredBy: "Susan Coke",
    isPublished: true
  },
  {
    slug: "hyperpigmentation-dark-spots",
    title: "Hyperpigmentation & Dark Spots",
    answerCapsule:
      "Hyperpigmentation happens when excess melanin builds up in patches after breakouts, irritation, or sun exposure. Consistent daily sun protection paired with targeted brightening ingredients like niacinamide helps fade dark spots evenly.",
    overview:
      "Uneven tone and post-blemish marks linger when UV rays stimulate pigment-producing cells. Patience and daily SPF are essential so fading progress isn't undone by sunlight.",
    commonTriggers: [
      "Unprotected sun exposure on healing blemishes or spots",
      "Picking or squeezing breakouts and dry patches",
      "Post-inflammatory marks after irritation"
    ],
    routineGuidance: {
      amSteps: [
        "Gentle cleanse",
        "Apply a tone-evening serum such as niacinamide",
        "Finish with daily broad-spectrum sunscreen"
      ],
      pmSteps: [
        "Cleanse gently",
        "Apply targeted treatment or hydrating serum",
        "Moisturize thoroughly overnight"
      ],
      avoidList: [
        "Picking blemishes",
        "Skipping sunscreen on cloudy days"
      ]
    },
    recommendedIngredientSlugs: ["niacinamide"],
    relatedProductSlugs: [],
    faqs: [
      {
        question: "Why do dark spots get darker in the sun?",
        answer: "Sunlight triggers melanin production to protect skin cells, which deepens existing pigment spots and makes post-acne marks last longer."
      }
    ],
    authoredBy: "Susan Coke",
    isPublished: true
  }
];

const SEED_INGREDIENTS = [
  {
    slug: "niacinamide",
    name: "Niacinamide",
    inciName: "Niacinamide",
    answerCapsule:
      "Niacinamide is a form of vitamin B3 widely used in skincare to support skin barrier comfort, help balance visible oiliness, and improve the look of uneven tone and enlarged-looking pores.",
    whatItDoes:
      "Supports healthy surface lipids, calms the look of redness, and promotes a smoother, more balanced-looking complexion without heavy greasiness.",
    bestForConcerns: ["skin-barrier-repair", "hyperpigmentation-dark-spots"],
    usageTips: [
      "Apply once or twice daily after cleansing and before heavier creams.",
      "If your skin is sensitive, start with a gentle 2% to 5% formula."
    ],
    pairingNotes: {
      pairsWellWith: ["Hyaluronic Acid", "Ceramides", "Daily SPF"],
      cautionWith: ["Layering multiple strong acids at the same time if skin is sensitive"]
    },
    relatedProductSlugs: [],
    faqs: [
      {
        question: "Can I use niacinamide every day?",
        answer: "Yes, niacinamide is generally well-suited for daily morning and evening routines once patch-tested."
      }
    ],
    authoredBy: "Susan Coke",
    isPublished: true
  },
  {
    slug: "hyaluronic-acid",
    name: "Hyaluronic Acid",
    inciName: "Hydrolyzed Hyaluronic Acid / Sodium Hyaluronate",
    answerCapsule:
      "Hyaluronic acid is a humectant ingredient that attracts and holds water near the skin's surface to plump the look of fine dehydration lines and relieve tightness.",
    whatItDoes:
      "Boosts surface hydration and cushion so skin feels softer and more supple without clogging pores.",
    bestForConcerns: ["skin-barrier-repair"],
    usageTips: [
      "Apply onto slightly damp skin rather than bone-dry skin.",
      "Follow with a moisturizer so hydration stays locked in."
    ],
    pairingNotes: {
      pairsWellWith: ["Niacinamide", "Moisturizers", "Sunscreen"],
      cautionWith: ["Applying in very dry air without a moisturizer layer on top"]
    },
    relatedProductSlugs: [],
    faqs: [
      {
        question: "Does hyaluronic acid replace moisturizer?",
        answer: "No—hyaluronic acid binds water, while a moisturizer helps seal that hydration in and supports the skin barrier."
      }
    ],
    authoredBy: "Susan Coke",
    isPublished: true
  }
];

async function seedSkinKnowledge() {
  for (const concern of SEED_CONCERNS) {
    await Concern.updateOne({ slug: concern.slug }, { $set: concern }, { upsert: true });
  }
  for (const ingredient of SEED_INGREDIENTS) {
    await Ingredient.updateOne({ slug: ingredient.slug }, { $set: ingredient }, { upsert: true });
  }
  return { concerns: SEED_CONCERNS.length, ingredients: SEED_INGREDIENTS.length };
}

if (require.main === module) {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error("Missing MONGODB_URI environment variable.");
    process.exit(1);
  }
  mongoose.connect(uri).then(async () => {
    const res = await seedSkinKnowledge();
    console.log("Seeded Skin Knowledge:", res);
    await mongoose.disconnect();
    process.exit(0);
  }).catch((err) => {
    console.error("Seeding error:", err);
    process.exit(1);
  });
}

module.exports = { seedSkinKnowledge };
