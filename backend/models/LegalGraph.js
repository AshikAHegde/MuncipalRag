import mongoose from 'mongoose';

const legalNodeSchema = new mongoose.Schema({
  sectionId:      { type: String, required: true, unique: true, index: true },
  sectionNumber:  { type: String, required: true },
  actName:        { type: String, required: true },
  sectionTitle:   { type: String, default: "" },
  domain:         { type: String, enum: ["criminal","civil","corporate","tax","general"] },
  summary:        { type: String, default: "" },
  punishment:     { type: String, default: "" },
  sourceDocId:    { type: String, index: true },
  pineconeChunkIds: [String],
  edges: [{
    targetSectionId: { type: String, required: true },
    type:       { type: String, enum: [
      "REFERENCES","READ_WITH","AMENDED_BY","SUBJECT_TO",
      "NOTWITHSTANDING","PREREQUISITE","EXCEPTION","ESCALATION","CROSS_DOMAIN"
    ]},
    confidence: { type: String, enum: ["high", "ai_inferred"], default: "high" },
    reason:     { type: String, default: "" },
    extractedFrom: { type: String, default: "" },
  }],
}, { timestamps: true });

const LegalGraph = mongoose.model('LegalGraph', legalNodeSchema);

export default LegalGraph;
