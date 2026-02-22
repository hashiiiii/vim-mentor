// =============================================================================
// dashboard.ts
// Webview-based dashboard showing learning statistics.
// =============================================================================

import * as vscode from "vscode";
import * as storage from "./storage";
import * as feedback from "./feedback";
import {
  getConfig,
  TEACHING_MODE_NAMES,
  LEARNING_LEVEL_NAMES,
} from "./config";

// -----------------------------------------------------------------------------
// Dashboard Panel
// -----------------------------------------------------------------------------

let panel: vscode.WebviewPanel | undefined;

/**
 * Open (or reveal) the Vim Mentor dashboard.
 */
export function openDashboard(extensionUri: vscode.Uri): void {
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    updateDashboard();
    return;
  }

  panel = vscode.window.createWebviewPanel(
    "vimMentorDashboard",
    "Vim Mentor - Dashboard",
    vscode.ViewColumn.One,
    {
      enableScripts: false,
      retainContextWhenHidden: false,
    }
  );

  panel.onDidDispose(() => {
    panel = undefined;
  });

  updateDashboard();
}

/**
 * Update the dashboard content with current data.
 */
function updateDashboard(): void {
  if (!panel) {
    return;
  }

  const data = storage.load();
  const sessionStats = feedback.getStats();
  const config = getConfig();

  panel.webview.html = renderHTML(data, sessionStats, config);
}

// -----------------------------------------------------------------------------
// HTML Rendering
// -----------------------------------------------------------------------------

function renderHTML(
  data: storage.ProgressData,
  session: ReturnType<typeof feedback.getStats>,
  config: ReturnType<typeof getConfig>
): string {
  const levelName =
    LEARNING_LEVEL_NAMES[config.learningLevel] ?? "Unknown";
  const modeName =
    TEACHING_MODE_NAMES[config.teachingMode] ?? "Unknown";

  // Progress bar
  const threshold = config.advanceThreshold;
  const progressCount = data.lifetime.correct % threshold;
  const progressPct = Math.floor((progressCount / threshold) * 100);

  // Top commands table
  const sortedCommands = Object.entries(data.commands)
    .map(([cmd, stats]) => ({ cmd, ...stats }))
    .sort((a, b) => (b.prompted + b.correct) - (a.prompted + a.correct))
    .slice(0, 10);

  const commandRows = sortedCommands
    .map((entry) => {
      const total = entry.correct + entry.prompted;
      const acc = total > 0 ? Math.floor((entry.correct / total) * 100) : 0;
      return `
        <tr>
          <td><code>${escapeHtml(entry.cmd)}</code></td>
          <td>${entry.correct}</td>
          <td>${entry.prompted}</td>
          <td>${acc}%</td>
        </tr>`;
    })
    .join("\n");

  // Recent sessions table
  const recentSessions = data.sessions.slice(-5).reverse();
  const sessionRows = recentSessions
    .map((s) => {
      const total = s.correct + s.incorrect;
      const acc = total > 0 ? Math.floor((s.correct / total) * 100) : 0;
      return `
        <tr>
          <td>${escapeHtml(s.date)}</td>
          <td>${s.correct}</td>
          <td>${s.incorrect}</td>
          <td>${acc}%</td>
          <td>${s.bestStreak}</td>
          <td>${s.durationMinutes}m</td>
        </tr>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vim Mentor Dashboard</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background);
      --fg: var(--vscode-editor-foreground);
      --border: var(--vscode-panel-border);
      --accent: var(--vscode-textLink-foreground);
      --success: #4e9a06;
      --warning: #c4a000;
      --error: #cc0000;
      --muted: var(--vscode-descriptionForeground);
    }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--fg);
      background: var(--bg);
      padding: 20px 30px;
      line-height: 1.6;
    }
    h1 {
      font-size: 1.6em;
      border-bottom: 2px solid var(--border);
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    h2 {
      font-size: 1.2em;
      color: var(--accent);
      margin-top: 30px;
      margin-bottom: 10px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: var(--vscode-sideBar-background, #1e1e1e);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 15px;
      text-align: center;
    }
    .stat-card .value {
      font-size: 2em;
      font-weight: bold;
      display: block;
    }
    .stat-card .label {
      font-size: 0.85em;
      color: var(--muted);
    }
    .stat-card.success .value { color: var(--success); }
    .stat-card.warning .value { color: var(--warning); }
    .stat-card.error .value { color: var(--error); }
    .stat-card.accent .value { color: var(--accent); }
    .progress-bar-container {
      background: var(--vscode-input-background);
      border-radius: 4px;
      height: 24px;
      margin: 10px 0;
      overflow: hidden;
      position: relative;
    }
    .progress-bar-fill {
      background: var(--accent);
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .progress-bar-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 0.85em;
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      text-align: left;
      padding: 8px 12px;
      border-bottom: 1px solid var(--border);
    }
    th {
      color: var(--muted);
      font-weight: 600;
      font-size: 0.9em;
    }
    code {
      background: var(--vscode-textCodeBlock-background);
      padding: 2px 6px;
      border-radius: 3px;
      font-family: var(--vscode-editor-font-family);
    }
    .info-row {
      display: flex;
      gap: 30px;
      margin-bottom: 8px;
    }
    .info-label {
      color: var(--muted);
      min-width: 140px;
    }
    .empty-state {
      color: var(--muted);
      font-style: italic;
      padding: 10px 0;
    }
  </style>
</head>
<body>
  <h1>Vim Mentor - Learning Dashboard</h1>

  <div class="info-row">
    <span class="info-label">Teaching Mode:</span>
    <span>${modeName} (Level ${config.teachingMode})</span>
  </div>
  <div class="info-row">
    <span class="info-label">Learning Level:</span>
    <span>${levelName} (Level ${config.learningLevel})</span>
  </div>
  <div class="info-row">
    <span class="info-label">Auto Advance:</span>
    <span>${config.autoAdvance ? "On" : "Off"} (threshold: ${threshold})</span>
  </div>

  <h2>Current Session</h2>
  <div class="stats-grid">
    <div class="stat-card success">
      <span class="value">${session.totalCorrect}</span>
      <span class="label">Correct</span>
    </div>
    <div class="stat-card error">
      <span class="value">${session.totalIncorrect}</span>
      <span class="label">Incorrect</span>
    </div>
    <div class="stat-card warning">
      <span class="value">${session.accuracy}%</span>
      <span class="label">Accuracy</span>
    </div>
    <div class="stat-card accent">
      <span class="value">${session.streak}</span>
      <span class="label">Current Streak</span>
    </div>
  </div>

  <h2>Lifetime Statistics</h2>
  <div class="stats-grid">
    <div class="stat-card success">
      <span class="value">${data.lifetime.correct}</span>
      <span class="label">Total Correct</span>
    </div>
    <div class="stat-card error">
      <span class="value">${data.lifetime.incorrect}</span>
      <span class="label">Total Incorrect</span>
    </div>
    <div class="stat-card accent">
      <span class="value">${data.lifetime.bestStreak}</span>
      <span class="label">Best Streak</span>
    </div>
    <div class="stat-card">
      <span class="value">${data.lifetime.totalSessions}</span>
      <span class="label">Sessions</span>
    </div>
  </div>

  <h2>Level Progress</h2>
  <div class="progress-bar-container">
    <div class="progress-bar-fill" style="width: ${progressPct}%"></div>
    <span class="progress-bar-text">${progressCount} / ${threshold}</span>
  </div>
  <p style="color: var(--muted); font-size: 0.9em;">
    Level ${config.learningLevel} &rarr; Level ${Math.min(config.learningLevel + 1, 5)}
  </p>

  <h2>Most Practiced Commands</h2>
  ${
    sortedCommands.length > 0
      ? `<table>
      <thead>
        <tr>
          <th>Command</th>
          <th>Correct</th>
          <th>Prompted</th>
          <th>Accuracy</th>
        </tr>
      </thead>
      <tbody>
        ${commandRows}
      </tbody>
    </table>`
      : '<p class="empty-state">No data yet. Start using the editor and Vim Mentor will track your progress.</p>'
  }

  <h2>Recent Sessions</h2>
  ${
    recentSessions.length > 0
      ? `<table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Correct</th>
          <th>Incorrect</th>
          <th>Accuracy</th>
          <th>Best Streak</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>
        ${sessionRows}
      </tbody>
    </table>`
      : '<p class="empty-state">No session history yet.</p>'
  }
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// -----------------------------------------------------------------------------
// Disposal
// -----------------------------------------------------------------------------

export function dispose(): void {
  if (panel) {
    panel.dispose();
    panel = undefined;
  }
}
