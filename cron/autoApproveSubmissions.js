// cron/autoApproveSubmissions.js
const cron = require("node-cron");
const { Op } = require("sequelize");
const {
  WorkSubmission,
  SubmissionRevision,
  CreatorJob,
  CreatorProfile,
  Campaign,
  Transaction,
} = require("../models");

const { approveSubmission } = require("../services/workSubmissionService");
const { releaseFundsToCreator } = require("../services/tradesafePaymentService");

const REVISION_STATUSES = {
  PENDING_REVIEW: "pending_review",
  APPROVED: "approved",
  REVISION_REQUESTED: "revision_requested",
  REJECTED: "rejected",
};

// ============================================================
// CONFIG
// ============================================================
const AUTO_APPROVE_DAYS = 3;
const BATCH_SIZE = 50;

const ESCROW_OK_STATUSES = [
  "FUNDED",
  "RELEASED",
  "PAYOUT_TRIGGERED",
  "COMPLETED",
];

// ============================================================
// MAIN CRON RUNNER
// ============================================================
async function runAutoApproval(io) {
  const startedAt = new Date();
  const cutoff = new Date(
    startedAt.getTime() - AUTO_APPROVE_DAYS * 24 * 60 * 60 * 1000
  );

  console.log(
    `[AutoApprove] ▶ Start | now=${startedAt.toISOString()} | cutoff=${cutoff.toISOString()} | days=${AUTO_APPROVE_DAYS}`
  );

  let processed = 0;
  let approved = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // ✅ PRODUCTION: only process revisions older than 3 days
    const staleRevisions = await SubmissionRevision.findAll({
      where: {
        status: REVISION_STATUSES.PENDING_REVIEW,
        submittedAt: { [Op.lte]: cutoff },
      },
      include: [
        {
          model: WorkSubmission,
          as: "submission",
          required: true,
          attributes: ["id", "publicId", "jobId"],
          include: [
            {
              model: CreatorJob,
              as: "job",
              required: true,
              attributes: ["id", "publicId", "status", "campaignId"],
              include: [
                {
                  model: Campaign,
                  as: "campaign",
                  required: true,
                  attributes: ["id", "publicId", "brandId"],
                },
                {
                  model: CreatorProfile,
                  as: "creator",
                  required: true,
                  attributes: ["id", "email"],
                },
              ],
            },
          ],
        },
      ],
      limit: BATCH_SIZE,
      order: [["submittedAt", "ASC"]],
    });

    console.log(
      `[AutoApprove] Found ${staleRevisions.length} stale revision(s) (>${AUTO_APPROVE_DAYS} days old)`
    );

    if (staleRevisions.length === 0) {
      console.log("[AutoApprove] ✅ Nothing to do");
      return;
    }

    // Process one by one
    for (const revision of staleRevisions) {
      processed++;
      console.log(
        `\n[AutoApprove] ─── [${processed}/${staleRevisions.length}] Revision ${revision.publicId} ───`
      );
      try {
        const result = await processOneRevision(revision, io);
        if (result === "approved") approved++;
        else if (result === "skipped") skipped++;
      } catch (err) {
        failed++;
        console.error(
          `[AutoApprove] ✗ Failed for revision ${revision.publicId || revision.id}:`,
          err.message
        );
      }
    }

    const duration = ((Date.now() - startedAt.getTime()) / 1000).toFixed(2);
    console.log(
      `\n[AutoApprove] ✅ Done in ${duration}s | processed=${processed} | approved=${approved} | skipped=${skipped} | failed=${failed}`
    );
  } catch (err) {
    console.error("[AutoApprove] ✗ Fatal error:", err);
  }
}

// ============================================================
// PROCESS A SINGLE REVISION
// ============================================================
async function processOneRevision(revision, io) {
  const submission = revision.submission;
  const job = submission?.job;
  const campaign = job?.campaign;
  const creator = job?.creator;

  // 1. Relation sanity check
  if (!submission || !job || !campaign || !creator) {
    console.warn(
      `[AutoApprove] ⏭ Skip ${revision.publicId} — missing relations`
    );
    return "skipped";
  }

  // 2. Job status guard
  if (job.status === "approved") {
    console.log(
      `[AutoApprove] ⏭ Skip ${revision.publicId} — job already approved`
    );
    return "skipped";
  }

  if (job.status === "cancelled") {
    console.log(
      `[AutoApprove] ⏭ Skip ${revision.publicId} — job cancelled`
    );
    return "skipped";
  }

  // 3. Fresh idempotency check
  const freshRevision = await SubmissionRevision.findByPk(revision.id, {
    attributes: ["id", "status", "publicId"],
  });

  if (
    !freshRevision ||
    freshRevision.status !== REVISION_STATUSES.PENDING_REVIEW
  ) {
    console.log(
      `[AutoApprove] ⏭ Skip ${revision.publicId} — status now "${freshRevision?.status}"`
    );
    return "skipped";
  }

  // 4. Escrow check
  const escrowTx = await Transaction.findOne({
    where: {
      campaignId: campaign.id,
      creatorUserId: creator.id,
    },
    attributes: ["id", "status"],
  });

  if (!escrowTx || !ESCROW_OK_STATUSES.includes(escrowTx.status)) {
    console.warn(
      `[AutoApprove] ⚠ Skip ${revision.publicId} — escrow not funded (status=${escrowTx?.status || "NOT_FOUND"})`
    );
    return "skipped";
  }

  // 5. ✅ Same approveSubmission() that manual flow uses
  await approveSubmission(submission.publicId, campaign.brandId, io);

  console.log(
    `[AutoApprove] ✓ Approved submission ${submission.publicId} (revision ${revision.revisionNumber})`
  );

  // 6. Release funds
  try {
    const releaseResult = await releaseFundsToCreator(
      campaign.id,
      creator.id,
      campaign.brandId
    );

    console.log(
      `[AutoApprove] 💰 Funds released for ${submission.publicId} | status=${releaseResult?.status}`
    );
  } catch (releaseErr) {
    console.error(
      `[AutoApprove] ⚠ Funds release FAILED for ${submission.publicId}:`,
      releaseErr.message
    );
  }

  return "approved";
}

// ============================================================
// CRON REGISTRATION
// ============================================================
cron.schedule(
  "0 * * * *",
  async () => {
    console.log("[Cron] ⏰ Triggering auto-approve sweep");
    const io = global.__IO__ || null;
    try {
      await runAutoApproval(io);
    } catch (err) {
      console.error("[Cron] ✗ Auto-approve sweep failed:", err.message);
    }
  },
  {
    scheduled: true,
    timezone: "UTC",
  }
);

console.log("[Cron] ✅ Auto-approve job registered (hourly @ minute 0 UTC)");

module.exports = { runAutoApproval };