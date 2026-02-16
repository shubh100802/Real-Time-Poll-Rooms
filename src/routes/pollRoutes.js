// ========== IMPORTS ========== //
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const Poll = require("../models/Poll");

// ========== ROUTER + CONSTANTS ========== //
const router = express.Router();
const QUESTION_MAX_LENGTH = 300;
const OPTION_MAX_LENGTH = 120;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;
const TOKEN_MAX_LENGTH = 128;

// ========== HELPERS ========== //
function normalizeOptions(options) {
  if (!Array.isArray(options)) {
    return [];
  }

  const seen = new Set();
  const uniqueTexts = [];

  for (const rawOption of options) {
    const text = String(rawOption || "").trim();
    if (!text) {
      continue;
    }

    const key = text.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    uniqueTexts.push(text);
  }

  return uniqueTexts.map((text) => ({ text, votes: 0 }));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function totalVotes(options) {
  return options.reduce((sum, option) => sum + option.votes, 0);
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }

  return String(req.ip || req.socket?.remoteAddress || "unknown");
}

function pollPayload(poll) {
  return {
    pollId: poll._id,
    question: poll.question,
    options: poll.options,
    totalVotes: totalVotes(poll.options),
  };
}

function stripTrailingSlashes(url) {
  return String(url || "").replace(/\/+$/, "");
}

// ========== VIEW RENDERER ========== //
function renderPollPage(poll) {
  const encodedOptions = encodeURIComponent(JSON.stringify(poll.options));

  const optionRows = poll.options
    .map(
      (option, index) => `
        <label class="option-row">
          <input type="radio" name="optionIndex" value="${index}" required />
          <span>${escapeHtml(option.text)}</span>
        </label>
      `
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Poll</title>
    <style>
      :root {
        --bg: #eef1f5;
        --panel: #ffffff;
        --ink: #15202b;
        --muted: #5c6b7a;
        --line: #d5dce3;
        --brand: #1d4ed8;
        --brand-soft: #dbe8ff;
        --ok: #0f7a2a;
        --danger: #b42318;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: Verdana, "Segoe UI", Tahoma, sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 90% 8%, #d9e5ff 0%, transparent 35%),
          radial-gradient(circle at 10% 92%, #c9f0e4 0%, transparent 30%),
          var(--bg);
        display: grid;
        place-items: center;
        padding: 20px;
      }
      .wrap {
        width: min(780px, 100%);
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 16px;
        box-shadow: 0 16px 36px rgba(21, 32, 43, 0.08);
        padding: 22px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 28px;
        line-height: 1.2;
      }
      .sub {
        margin: 0 0 18px;
        color: var(--muted);
      }
      form {
        display: grid;
        gap: 12px;
      }
      .option-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #fff;
      }
      button[type="submit"] {
        margin-top: 8px;
        padding: 11px;
        font-size: 16px;
        border: 0;
        border-radius: 10px;
        background: var(--brand);
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      button[type="submit"]:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
      .results {
        margin-top: 22px;
        border-top: 1px solid var(--line);
        padding-top: 16px;
      }
      .results h2 {
        margin: 0 0 8px;
      }
      .count {
        margin: 0 0 12px;
        color: var(--muted);
      }
      .result-item {
        margin-bottom: 10px;
      }
      .empty-state {
        color: var(--muted);
        margin: 8px 0 14px;
      }
      .result-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        font-size: 14px;
        margin-bottom: 4px;
      }
      .bar {
        width: 100%;
        height: 10px;
        border-radius: 999px;
        background: #edf1f5;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #60a5fa, #2563eb);
        width: 0;
        transition: width 180ms ease;
      }
      #error {
        color: var(--danger);
        margin-top: 12px;
        min-height: 20px;
      }
      #success {
        color: var(--ok);
        margin-top: 4px;
        min-height: 20px;
      }
      .voted {
        margin-top: 8px;
        padding: 8px 10px;
        border-radius: 8px;
        background: var(--brand-soft);
        color: #1e3a8a;
        display: none;
      }
    </style>
  </head>
  <body>
    <main class="wrap">
      <h1>${escapeHtml(poll.question)}</h1>
      <p class="sub">Choose one option. Results update live for everyone in this room.</p>

      <form id="voteForm">
        ${optionRows}
        <button type="submit">Submit Vote</button>
      </form>

      <p id="error"></p>
      <p id="success"></p>
      <p id="votedNote" class="voted">You have already voted in this poll from this browser or network.</p>

      <section class="results">
        <h2>Current Results</h2>
        <p class="count">Total votes: <strong id="totalVotes"></strong></p>
        <div id="resultList"></div>
      </section>
    </main>

    <script src="/socket.io/socket.io.js"></script>
    <script>
      // ========== CLIENT STATE ========== //
      const pollId = "${poll._id}";
      const voteForm = document.getElementById("voteForm");
      const errorText = document.getElementById("error");
      const successText = document.getElementById("success");
      const totalVotesEl = document.getElementById("totalVotes");
      const resultList = document.getElementById("resultList");
      const votedNote = document.getElementById("votedNote");
      const socket = io();
      let isSubmitting = false;
      let hasVoted = false;
      let duplicateVoteBlocked = false;

      // ========== CLIENT HELPERS ========== //
      let currentOptions = JSON.parse(decodeURIComponent("${encodedOptions}"));

      function escapeText(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function renderResults(options) {
        const total = options.reduce((sum, option) => sum + option.votes, 0);
        totalVotesEl.textContent = String(total);

        const barsHtml = options
          .map((option) => {
            const percentage = total > 0 ? Math.round((option.votes / total) * 100) : 0;
            return "<div class=\\"result-item\\">"
              + "<div class=\\"result-head\\"><span>" + escapeText(option.text) + "</span><span><strong>" + option.votes + "</strong> (" + percentage + "%)</span></div>"
              + "<div class=\\"bar\\"><div class=\\"bar-fill\\" style=\\"width: " + percentage + "%\\"></div></div>"
              + "</div>";
          })
          .join("");

        const emptyNote = total === 0 ? "<p class=\\"empty-state\\">No votes yet. Be the first to vote.</p>" : "";
        resultList.innerHTML = emptyNote + barsHtml;
      }

      function applyVotedState() {
        const submitButton = voteForm.querySelector("button[type='submit']");
        const options = voteForm.querySelectorAll("input[name='optionIndex']");
        const disabled = hasVoted || isSubmitting;

        if (submitButton) {
          submitButton.disabled = disabled;
          if (hasVoted) {
            submitButton.textContent = "Vote Submitted";
          } else if (isSubmitting) {
            submitButton.textContent = "Submitting...";
          } else {
            submitButton.textContent = "Submit Vote";
          }
        }

        options.forEach((el) => {
          el.disabled = hasVoted;
        });

        votedNote.style.display = duplicateVoteBlocked ? "block" : "none";
      }

      function getOrCreateVoterToken() {
        const key = "pollVoterToken";
        const existing = localStorage.getItem(key);

        if (existing && existing.trim()) {
          return existing;
        }

        let created;
        if (window.crypto && typeof window.crypto.randomUUID === "function") {
          created = window.crypto.randomUUID();
        } else {
          created = "token-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
        }

        localStorage.setItem(key, created);
        return created;
      }

      const voterToken = getOrCreateVoterToken();

      // ========== SOCKET EVENTS ========== //
      socket.emit("poll:join", pollId);
      socket.on("poll:update", (payload) => {
        if (!payload || payload.pollId !== pollId || !Array.isArray(payload.options)) {
          return;
        }

        currentOptions = payload.options;
        renderResults(currentOptions);
      });

      // ========== VOTE SUBMIT FLOW ========== //
      voteForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        errorText.textContent = "";
        successText.textContent = "";
        if (isSubmitting || hasVoted) {
          return;
        }

        const formData = new FormData(voteForm);
        const selected = formData.get("optionIndex");

        if (selected === null) {
          errorText.textContent = "Please select one option.";
          return;
        }

        try {
          isSubmitting = true;
          applyVotedState();

          const response = await fetch("/poll/" + pollId + "/vote", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              optionIndex: Number(selected),
              voterToken,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            errorText.textContent = data.error || "Failed to submit vote.";
            if (response.status === 409) {
              hasVoted = true;
              duplicateVoteBlocked = true;
              applyVotedState();
            }
            return;
          }

          hasVoted = true;
          duplicateVoteBlocked = false;
          applyVotedState();
          successText.textContent = "Vote submitted.";
        } finally {
          isSubmitting = false;
          applyVotedState();
        }
      });

      renderResults(currentOptions);
      applyVotedState();
    </script>
  </body>
</html>
  `;
}

// ========== ROUTES ========== //
router.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "views", "createPoll.html"));
});

router.post("/poll", async (req, res, next) => {
  try {
    const question = String(req.body.question || "").trim();
    const options = normalizeOptions(req.body.options);

    if (!question) {
      return res.status(400).json({ error: "Question is required." });
    }

    if (question.length > QUESTION_MAX_LENGTH) {
      return res.status(400).json({ error: "Question is too long." });
    }

    if (options.length < MIN_OPTIONS) {
      return res.status(400).json({ error: "At least 2 unique options are required." });
    }

    if (options.length > MAX_OPTIONS) {
      return res.status(400).json({ error: `At most ${MAX_OPTIONS} options are allowed.` });
    }

    if (options.some((option) => option.text.length > OPTION_MAX_LENGTH)) {
      return res.status(400).json({ error: "One or more options are too long." });
    }

    const poll = await Poll.create({ question, options });
    const configuredBaseUrl = process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
    const baseUrl = stripTrailingSlashes(configuredBaseUrl);

    return res.status(201).json({
      message: "Poll created successfully.",
      pollId: poll._id,
      shareUrl: `${baseUrl}/poll/${poll._id}`,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/poll/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid poll ID." });
    }

    const poll = await Poll.findById(id).lean();

    if (!poll) {
      return res.status(404).json({ error: "Poll not found." });
    }

    return res.status(200).send(renderPollPage(poll));
  } catch (error) {
    return next(error);
  }
});

router.post("/poll/:id/vote", async (req, res, next) => {
  try {
    const { id } = req.params;
    const optionIndex = Number(req.body.optionIndex);
    const voterToken = String(req.body.voterToken || "").trim();
    const clientIp = getClientIp(req);

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid poll ID." });
    }

    if (!Number.isInteger(optionIndex)) {
      return res.status(400).json({ error: "optionIndex must be an integer." });
    }

    if (!voterToken) {
      return res.status(400).json({ error: "voterToken is required." });
    }

    if (voterToken.length > TOKEN_MAX_LENGTH) {
      return res.status(400).json({ error: "voterToken is too long." });
    }

    const poll = await Poll.findById(id).lean();

    if (!poll) {
      return res.status(404).json({ error: "Poll not found." });
    }

    if (optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ error: "Invalid option index." });
    }

    const votePath = `options.${optionIndex}.votes`;

    const updatedPoll = await Poll.findOneAndUpdate(
      {
        _id: id,
        voterIps: { $ne: clientIp },
        voterTokens: { $ne: voterToken },
      },
      {
        $inc: { [votePath]: 1 },
        $addToSet: {
          voterIps: clientIp,
          voterTokens: voterToken,
        },
      },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedPoll) {
      const pollExists = await Poll.exists({ _id: id });
      if (!pollExists) {
        return res.status(404).json({ error: "Poll not found." });
      }

      return res.status(409).json({
        error: "You have already voted from this browser or network.",
      });
    }

    const payload = pollPayload(updatedPoll);
    const io = req.app.get("io");

    if (io) {
      io.to(`poll:${id}`).emit("poll:update", payload);
    }

    return res.status(200).json(payload);
  } catch (error) {
    return next(error);
  }
});

// ========== EXPORT ========== //
module.exports = router;
