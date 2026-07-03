const CHAPTER_STATUSES = Object.freeze({
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  REVIEWED: "reviewed",
});

const TITLE_PROPOSAL_STATUSES = Object.freeze({
  NONE: "none",
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
});

const DEFAULT_THESIS_CHAPTERS = Object.freeze([
  { key: "ch1", title: "Chapter 1: Introduction" },
  { key: "ch2", title: "Chapter 2: Literature Review" },
  { key: "ch3", title: "Chapter 3: Methodology" },
  { key: "ch4", title: "Chapter 4: Results / Findings" },
  { key: "ch5", title: "Chapter 5: Discussion" },
  { key: "ch6", title: "Chapter 6: Conclusion & Recommendations" },
]);

function defaultChapters() {
  return DEFAULT_THESIS_CHAPTERS.map((c) => ({
    key: c.key,
    title: c.title,
    status: CHAPTER_STATUSES.PENDING,
    notes: "",
    updatedAt: null,
    updatedBy: null,
  }));
}

function emptyTitleProposal() {
  return {
    title: "",
    status: TITLE_PROPOSAL_STATUSES.NONE,
    proposedAt: null,
    proposedBy: null,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: "",
  };
}

function buildActivityTimeline(group) {
  const items = [];

  if (group.createdAt) {
    items.push({
      type: "group_created",
      at: group.createdAt,
      label: "Thesis group created",
      detail: group.title || group.titleProposal?.title || "Untitled",
    });
  }

  if (group.supervisorId && group.supervisorAssignedAt) {
    items.push({
      type: "supervisor_assigned",
      at: group.supervisorAssignedAt,
      label: "Supervisor assigned",
      detail: "",
    });
  }

  const proposal = group.titleProposal;
  if (proposal?.proposedAt && proposal.status === TITLE_PROPOSAL_STATUSES.PENDING) {
    items.push({
      type: "title_proposed",
      at: proposal.proposedAt,
      label: "Supervisor recorded student thesis title",
      detail: proposal.title || "",
    });
  }

  if (proposal?.reviewedAt && proposal.status === TITLE_PROPOSAL_STATUSES.ACCEPTED) {
    items.push({
      type: "title_accepted",
      at: proposal.reviewedAt,
      label: "Thesis title accepted (wa la aqbalay)",
      detail: proposal.title || group.title || "",
    });
  }

  if (proposal?.reviewedAt && proposal.status === TITLE_PROPOSAL_STATUSES.REJECTED) {
    items.push({
      type: "title_rejected",
      at: proposal.reviewedAt,
      label: "Thesis title rejected",
      detail: proposal.reviewNote || proposal.title || "",
    });
  }

  for (const ch of group.chapters || []) {
    if (ch.updatedAt && ch.status !== CHAPTER_STATUSES.PENDING) {
      items.push({
        type: "chapter_update",
        at: ch.updatedAt,
        label: `${ch.title} — ${ch.status.replace(/_/g, " ")}`,
        detail: ch.notes || "",
        chapterKey: ch.key,
      });
    }
  }

  for (const m of group.meetings || []) {
    const at = m.createdAt || m.date;
    if (!at) continue;
    const chapterLabels = (m.chaptersDiscussed || [])
      .map((key) => (group.chapters || []).find((c) => c.key === key)?.title || key)
      .filter(Boolean);
    items.push({
      type: "meeting",
      at,
      label: "Meeting logged",
      detail: [m.agenda, m.location, chapterLabels.length ? `Chapters: ${chapterLabels.join(", ")}` : ""]
        .filter(Boolean)
        .join(" • "),
      meetingDate: m.date,
    });
  }

  return items.sort((a, b) => new Date(b.at) - new Date(a.at));
}

module.exports = {
  CHAPTER_STATUSES,
  TITLE_PROPOSAL_STATUSES,
  DEFAULT_THESIS_CHAPTERS,
  defaultChapters,
  emptyTitleProposal,
  buildActivityTimeline,
};
