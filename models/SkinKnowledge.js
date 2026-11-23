const mongoose = require("mongoose");

const faqItemSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const concernSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    title: { type: String, required: true, trim: true },
    answerCapsule: { type: String, required: true, trim: true },
    overview: { type: String, required: true, trim: true },
    commonTriggers: [{ type: String, trim: true }],
    routineGuidance: {
      amSteps: [{ type: String, trim: true }],
      pmSteps: [{ type: String, trim: true }],
      avoidList: [{ type: String, trim: true }]
    },
    recommendedIngredientSlugs: [{ type: String, lowercase: true, trim: true }],
    relatedProductSlugs: [{ type: String, trim: true }],
    faqs: { type: [faqItemSchema], default: [] },
    authoredBy: { type: String, default: "Susan Coke", trim: true },
    isPublished: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

const ingredientSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    inciName: { type: String, trim: true },
    answerCapsule: { type: String, required: true, trim: true },
    whatItDoes: { type: String, required: true, trim: true },
    bestForConcerns: [{ type: String, lowercase: true, trim: true }],
    usageTips: [{ type: String, trim: true }],
    pairingNotes: {
      pairsWellWith: [{ type: String, trim: true }],
      cautionWith: [{ type: String, trim: true }]
    },
    relatedProductSlugs: [{ type: String, trim: true }],
    faqs: { type: [faqItemSchema], default: [] },
    authoredBy: { type: String, default: "Susan Coke", trim: true },
    isPublished: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

const Concern = mongoose.models.Concern || mongoose.model("Concern", concernSchema);
const Ingredient = mongoose.models.Ingredient || mongoose.model("Ingredient", ingredientSchema);

module.exports = { Concern, Ingredient };
