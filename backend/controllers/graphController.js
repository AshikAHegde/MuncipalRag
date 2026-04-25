import UserChat from '../models/UserChat.js';
import LegalGraph from '../models/LegalGraph.js';

export const getSessionGraph = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const userChat = await UserChat.findOne({ userId });
    if (!userChat) {
      return res.status(404).json({ success: false, error: 'Chat history not found' });
    }

    const session = userChat.chatSessions.id(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const nodes = [];
    const edges = [];
    const processedSections = new Set();

    // 1. Add Session Node
    nodes.push({
      id: `session-${session._id}`,
      type: 'session',
      label: session.title,
      data: { mode: session.mode }
    });

    // 2. Add Conversation Nodes (Cards)
    session.conversations.forEach((conv, idx) => {
      const convId = `conv-${conv._id}`;
      nodes.push({
        id: convId,
        type: 'card',
        label: conv.question.substring(0, 30) + '...',
        data: {
          question: conv.question,
          answer: conv.answer,
          mode: conv.mode
        }
      });

      // Link Session to Card
      edges.push({
        id: `e-session-conv-${conv._id}`,
        source: `session-${session._id}`,
        target: convId,
        label: 'CONTAINS'
      });

      // Link Card to Previous Card (Chain of Thought)
      if (idx > 0) {
        const prevConvId = `conv-${session.conversations[idx - 1]._id}`;
        edges.push({
          id: `e-conv-chain-${conv._id}`,
          source: prevConvId,
          target: convId,
          label: 'NEXT',
          style: { 'line-style': 'dashed', 'opacity': 0.4 }
        });
      }

      // 3. Add Source Nodes (Sections) and Conflicts
      conv.sources.forEach((src) => {
        const sectionSlug = src.section || `Match-${idx}-${src.page}`;
        const sectionId = `sec-${sectionSlug}`;

        if (!processedSections.has(sectionId)) {
          nodes.push({
            id: sectionId,
            type: 'section',
            label: src.section || 'Cited Section',
            data: {
              section: src.section,
              page: src.page,
              text: src.text,
              source: src.source
            }
          });
          processedSections.add(sectionId);
        }

        edges.push({
          id: `e-conv-sec-${conv._id}-${sectionSlug}`,
          source: convId,
          target: sectionId,
          label: 'CITES'
        });
      });

      // 4. Add Conflict Insights (Lawyer Mode)
      if (conv.review?.conflicts && Array.isArray(conv.review.conflicts)) {
        conv.review.conflicts.forEach((conflict, cIdx) => {
          const conflictId = `conflict-${conv._id}-${cIdx}`;
          const sectionLabel = conflict.section || (conflict.section_number ? `Section ${conflict.section_number}` : `Issue ${cIdx + 1}`);
          
          nodes.push({
            id: conflictId,
            type: 'section',
            label: sectionLabel,
            data: {
              domain: conflict.domain,
              section: sectionLabel,
              sectionName: conflict.section_name,
              meaning: conflict.issue_meaning,
              reason: conflict.why_flagged,
              consequence: conflict.consequence
            }
          });

          edges.push({
            id: `e-conv-conflict-${conv._id}-${cIdx}`,
            source: convId,
            target: conflictId,
            label: 'FLAGGED'
          });
        });
      }
    });

    // 5. Add Inter-Section Relationships (Deep Knowledge Map)
    const activeSectionIds = Array.from(processedSections).map(id => id.replace('sec-', ''));
    if (activeSectionIds.length > 0) {
      const legalConnections = await LegalGraph.find({
        sectionId: { $in: activeSectionIds }
      });

      legalConnections.forEach(node => {
        node.edges.forEach(edge => {
          const targetId = `sec-${edge.targetSectionId}`;
          
          edges.push({
            id: `e-sec-sec-${node.sectionId}-${edge.targetSectionId}`,
            source: `sec-${node.sectionId}`,
            target: targetId,
            label: edge.type,
            data: { 
              type: edge.type, 
              reason: edge.reason,
              isInterSection: true 
            }
          });

          if (!processedSections.has(targetId)) {
            nodes.push({
              id: targetId,
              type: 'section',
              label: edge.targetSectionId,
              data: { section: edge.targetSectionId, isRelated: true }
            });
            processedSections.add(targetId);
          }
        });
      });
    }

    res.json({ success: true, graph: { nodes, edges } });
  } catch (error) {
    console.error('Error fetching session graph:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getProjectGraph = async (req, res) => {
  try {
    const userId = req.user._id;

    const userChat = await UserChat.findOne({ userId });
    if (!userChat) {
      return res.json({ success: true, graph: { nodes: [], edges: [] } });
    }

    const nodes = [];
    const edges = [];
    const processedSections = new Set();

    userChat.chatSessions.forEach((session) => {
      const sessionId = `session-${session._id}`;
      nodes.push({
        id: sessionId,
        type: 'session',
        label: session.title,
        data: { mode: session.mode }
      });

      session.conversations.forEach((conv) => {
        const convId = `conv-${conv._id}`;
        nodes.push({
          id: convId,
          type: 'card',
          label: conv.question.substring(0, 30) + '...',
          data: {
            question: conv.question,
            answer: conv.answer,
            mode: conv.mode
          }
        });

        edges.push({
          id: `e-session-conv-${conv._id}`,
          source: sessionId,
          target: convId,
          label: 'contains'
        });

        conv.sources.forEach((src) => {
          const sectionSlug = src.section || `Match-${src.page}`;
          const sectionId = `sec-${sectionSlug}`;

          if (!processedSections.has(sectionId)) {
            nodes.push({
              id: sectionId,
              type: 'section',
              label: src.section || 'Unknown Section',
              data: {
                section: src.section,
                page: src.page,
                text: src.text,
                source: src.source
              }
            });
            processedSections.add(sectionId);
          }

          edges.push({
            id: `e-conv-sec-${conv._id}-${sectionSlug}`,
            source: convId,
            target: sectionId,
            label: 'cites'
          });
        });
      });
    });

    // Also fetch inter-section relationships from LegalGraph if they exist
    const legalConnections = await LegalGraph.find({
      sectionId: { $in: Array.from(processedSections).map(id => id.replace('sec-', '')) }
    });

    legalConnections.forEach(node => {
      node.edges.forEach(edge => {
        const targetId = `sec-${edge.targetSectionId}`;
        // Only show links if the target section is also in the current view?
        // Or should we add the target section as a new node?
        // Let's add the link if it exists.
        edges.push({
          id: `e-sec-sec-${node.sectionId}-${edge.targetSectionId}`,
          source: `sec-${node.sectionId}`,
          target: targetId,
          label: edge.type,
          data: { type: edge.type, reason: edge.reason }
        });

        // Ensure target node exists
        if (!processedSections.has(targetId)) {
           nodes.push({
            id: targetId,
            type: 'section',
            label: edge.targetSectionId,
            data: { section: edge.targetSectionId }
          });
          processedSections.add(targetId);
        }
      });
    });

    res.json({ success: true, graph: { nodes, edges } });
  } catch (error) {
    console.error('Error fetching project graph:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const getMessageConflictGraph = async (req, res) => {
  try {
    const { sessionId, messageId } = req.params;
    const userId = req.user._id;

    const userChat = await UserChat.findOne({ userId });
    if (!userChat) {
      return res.status(404).json({ success: false, error: 'History not found' });
    }

    const session = userChat.chatSessions.id(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    const message = session.conversations.id(messageId);
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    const nodes = [];
    const edges = [];
    
    // 1. Central Card Node
    nodes.push({
      id: `message-${message._id}`,
      type: 'card',
      label: 'Client Case Analysis',
      data: { question: message.question, answer: message.answer }
    });

    // 2. Conflict Nodes
    const conflicts = message.review?.conflicts || [];
    conflicts.forEach((conflict, idx) => {
      const conflictId = `conflict-${idx}`;
      const sectionLabel = conflict.section || (conflict.section_number ? `Section ${conflict.section_number}` : `Provision ${idx + 1}`);
      
      nodes.push({
        id: conflictId,
        type: 'section',
        label: sectionLabel,
        data: {
          domain: conflict.domain,
          section: sectionLabel,
          sectionName: conflict.section_name,
          meaning: conflict.issue_meaning,
          reason: conflict.why_flagged,
          consequence: conflict.consequence
        }
      });

      // Edge from Case to Conflict
      edges.push({
        id: `e-case-conflict-${idx}`,
        source: `message-${message._id}`,
        target: conflictId,
        label: 'FLAGGED'
      });
    });

    // 2b. Add Citation Nodes (Sources)
    const sources = message.sources || [];
    sources.forEach((src, sIdx) => {
      const sectionLabel = src.section || `Source ${sIdx + 1}`;
      const sectionId = `sec-${sectionLabel}-${sIdx}`;

      nodes.push({
        id: sectionId,
        type: 'section',
        label: sectionLabel,
        data: {
          section: src.section,
          page: src.page,
          text: src.text,
          source: src.source,
          isCitation: true
        }
      });

      // Edge from Case to Citation
      edges.push({
        id: `e-case-source-${sIdx}`,
        source: `message-${message._id}`,
        target: sectionId,
        label: 'CITES'
      });
    });

    // 3. Cross-Domain and Inter-Section Links
    const sectionIds = conflicts.map(c => c.section || (c.section_number ? `Section ${c.section_number}` : null)).filter(Boolean);
    
    if (sectionIds.length > 0) {
      const legalConnections = await LegalGraph.find({
        sectionId: { $in: sectionIds }
      });

      legalConnections.forEach(node => {
        node.edges.forEach(edge => {
          const targetId = `sec-${edge.targetSectionId}`;
          const sourceId = nodes.find(n => n.label === node.sectionId || n.data?.section === node.sectionId)?.id;

          if (sourceId) {
             edges.push({
              id: `e-sec-sec-${node.sectionId}-${edge.targetSectionId}`,
              source: sourceId,
              target: targetId,
              label: edge.type,
              data: { 
                type: edge.type, 
                reason: edge.reason,
                isInterSection: true 
              }
            });

            if (!nodes.some(n => n.id === targetId)) {
              nodes.push({
                id: targetId,
                type: 'section',
                label: edge.targetSectionId,
                data: { section: edge.targetSectionId, isRelated: true }
              });
            }
          }
        });
      });
    }

    res.json({ success: true, graph: { nodes, edges } });
  } catch (error) {
    console.error('Error fetching message conflict graph:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
