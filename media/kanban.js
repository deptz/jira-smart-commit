(() => {
  const vscode = acquireVsCodeApi();
  const root = document.getElementById('app');

  const RECIPES = [
    'firstPrompt.task',
    'firstPrompt.bug',
    'security.review',
    'testCoverage.enforce',
    'pr.description',
    'pr.createBitbucket',
  ];

  let state = { columns: ['Backlog', 'Ready', 'Doing', 'Review', 'Done'], cards: [], runs: [], updatedAt: '' };

  function esc(text) {
    return String(text || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;');
  }

  function render() {
    root.innerHTML = `
      <div class="toolbar">
        <input id="title" placeholder="Card title" />
        <select id="recipe">${RECIPES.map((r) => `<option value="${r}">${r}</option>`).join('')}</select>
        <input id="jiraKey" placeholder="JIRA key (optional)" />
        <button class="primary" id="create">Create Card</button>
        <button id="refresh">Refresh</button>
        <span class="meta">Updated: ${esc(state.updatedAt)}</span>
      </div>
      <div class="columns">
        ${state.columns.map((col) => {
          const cards = state.cards.filter((c) => c.column === col);
          return `
          <section class="col">
            <h3>${esc(col)} (${cards.length})</h3>
            <div class="cards">
              ${cards.map(renderCard).join('') || '<div class="meta">No cards</div>'}
            </div>
          </section>`;
        }).join('')}
      </div>
      <section class="section">
        <h4>Recent Runs</h4>
        <table class="table">
          <thead><tr><th>Run</th><th>Card</th><th>Recipe</th><th>Status</th><th>Attempts</th><th>Error</th></tr></thead>
          <tbody>
            ${state.runs.map((r) => `
              <tr>
                <td>${esc(r.id)}</td>
                <td>${esc(r.cardId)}</td>
                <td>${esc(r.recipe)}</td>
                <td class="status-${esc(r.status)}">${esc(r.status)}</td>
                <td>${esc(r.attempts)}</td>
                <td>${esc(r.error || '')}</td>
              </tr>
            `).join('') || '<tr><td colspan="6" class="meta">No runs</td></tr>'}
          </tbody>
        </table>
      </section>
    `;

    document.getElementById('create').onclick = () => {
      const title = document.getElementById('title').value.trim();
      const recipe = document.getElementById('recipe').value;
      const jiraKey = document.getElementById('jiraKey').value.trim();
      vscode.postMessage({ type: 'createCard', payload: { title, recipe, jiraKey } });
      document.getElementById('title').value = '';
    };

    document.getElementById('refresh').onclick = () => vscode.postMessage({ type: 'refresh' });

    root.querySelectorAll('[data-action]').forEach((el) => {
      el.addEventListener('click', () => {
        const action = el.getAttribute('data-action');
        const cardId = el.getAttribute('data-card-id');
        const column = el.getAttribute('data-column');
        if (action === 'run') vscode.postMessage({ type: 'runCard', payload: { cardId } });
        if (action === 'preview') vscode.postMessage({ type: 'previewCard', payload: { cardId } });
        if (action === 'move') vscode.postMessage({ type: 'moveCard', payload: { cardId, column } });
        if (action === 'openPr') vscode.postMessage({ type: 'openPr', payload: { cardId } });
        if (action === 'delete') {
          const ok = window.confirm('Delete this card?');
          if (ok) vscode.postMessage({ type: 'deleteCard', payload: { cardId } });
        }
        if (action === 'edit') {
          const card = state.cards.find((c) => c.id === cardId);
          if (!card) return;
          const title = window.prompt('Card title', card.title);
          if (title === null) return;
          const jiraKey = window.prompt('JIRA key (optional)', card.jiraKey || '');
          if (jiraKey === null) return;
          const recipe = window.prompt('Recipe', card.recipe);
          if (recipe === null) return;
          vscode.postMessage({
            type: 'editCard',
            payload: { cardId, title: title.trim(), jiraKey: jiraKey.trim(), recipe: recipe.trim() },
          });
        }
      });
    });
  }

  function renderCard(card) {
    const next = state.columns.filter((c) => c !== card.column);
    return `
      <article class="card">
        <div class="card-title">${esc(card.title)}</div>
        <div class="meta">${esc(card.recipe)} ${card.jiraKey ? '• ' + esc(card.jiraKey) : ''}</div>
        ${card.prUrl ? `<div class="meta"><a href="#" data-action="openPr" data-card-id="${esc(card.id)}">${esc(card.prUrl)}</a></div>` : ''}
        <div class="actions">
          <button data-action="run" data-card-id="${esc(card.id)}">Run</button>
          <button data-action="preview" data-card-id="${esc(card.id)}">Preview</button>
          <button data-action="edit" data-card-id="${esc(card.id)}">Edit</button>
          <button data-action="delete" data-card-id="${esc(card.id)}">Delete</button>
          ${next.map((c) => `<button data-action="move" data-card-id="${esc(card.id)}" data-column="${esc(c)}">→ ${esc(c)}</button>`).join('')}
        </div>
      </article>
    `;
  }

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg?.type === 'boardState') {
      state = msg.payload;
      render();
    }
  });

  vscode.postMessage({ type: 'load' });
})();
