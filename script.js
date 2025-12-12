const state = loadState() || {
  people: [],
  items: [],
  sharedCharges: [],
  paidTotal: null,
};

const selectors = {
  peopleForm: document.querySelector("#peopleForm"),
  personName: document.querySelector("#personName"),
  peopleChips: document.querySelector("#peopleChips"),
  itemForm: document.querySelector("#itemForm"),
  itemLabel: document.querySelector("#itemLabel"),
  itemPrice: document.querySelector("#itemPrice"),
  itemQty: document.querySelector("#itemQty"),
  itemSharedDish: document.querySelector("#itemSharedDish"),
  quantityLabel: document.querySelector("#quantityLabel"),
  quantityHelp: document.querySelector("#quantityHelp"),
  itemsList: document.querySelector("#itemsList"),
  consumptionTable: document.querySelector("#consumptionTable"),
  chargeForm: document.querySelector("#chargeForm"),
  chargeLabel: document.querySelector("#chargeLabel"),
  chargeAmount: document.querySelector("#chargeAmount"),
  chargesList: document.querySelector("#chargesList"),
  paidTotal: document.querySelector("#paidTotal"),
  calculateBtn: document.querySelector("#calculateBtn"),
  copyBtn: document.querySelector("#copyBtn"),
  resultsTable: document.querySelector("#resultsTable"),
  resultsSummary: document.querySelector("#resultsSummary"),
};

function uuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function persistState() {
  localStorage.setItem("bill-splitter-state", JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem("bill-splitter-state");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.warn("Unable to load saved state", err);
    return null;
  }
}

function formatCurrency(val) {
  if (Number.isNaN(val)) return "0.00";
  return Number(val).toFixed(2);
}

function formatNumber(val) {
  if (Number.isNaN(val)) return "0.00";
  return Number(val).toFixed(2);
}

function addPerson(name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const id = uuid();
  state.people.push({ id, name: trimmed });
  state.items.forEach((item) => {
    item.consumptions[id] = item.consumptions[id] ?? 0;
  });
  persistState();
  renderAll();
}

function removePerson(id) {
  state.people = state.people.filter((p) => p.id !== id);
  state.items.forEach((item) => {
    delete item.consumptions[id];
  });
  state.sharedCharges.forEach((charge) => {
    if (Array.isArray(charge.participantIds)) {
      charge.participantIds = charge.participantIds.filter((pid) => pid !== id);
    }
  });
  persistState();
  renderAll();
}

function addItem({ label, totalPrice, totalQuantity, itemType }) {
  if (!label.trim()) return;
  const item = {
    id: uuid(),
    label: label.trim(),
    totalPrice: Number(totalPrice) || 0,
    totalQuantity: Number(totalQuantity) || 1,
    itemType: itemType || "units",
    consumptions: {},
  };
  state.people.forEach((p) => {
    item.consumptions[p.id] = 0;
  });
  state.items.push(item);
  persistState();
  renderAll();
}

function removeItem(id) {
  state.items = state.items.filter((it) => it.id !== id);
  persistState();
  renderAll();
}

function addSharedCharge({ label, amount }) {
  if (!label.trim()) return;
  state.sharedCharges.push({
    id: uuid(),
    label: label.trim(),
    amount: Number(amount) || 0,
    splitMode: "equal",
    participantIds: state.people.map((p) => p.id),
  });
  persistState();
  renderAll();
}

function removeSharedCharge(id) {
  state.sharedCharges = state.sharedCharges.filter((c) => c.id !== id);
  persistState();
  renderAll();
}

function updatePaidTotal(val) {
  const num = Number(val);
  state.paidTotal = Number.isFinite(num) && val !== "" ? num : null;
  persistState();
}

function onConsumptionChange(itemId, personId, value) {
  const focusInfo = captureConsumptionFocus();
  const item = state.items.find((it) => it.id === itemId);
  if (!item) return;
  const num = Number(value);
  item.consumptions[personId] = Number.isFinite(num) ? num : 0;
  persistState();
  renderConsumptionTable(focusInfo);
  renderResults();
}

function splitItemEqually(itemId) {
  const item = state.items.find((it) => it.id === itemId);
  if (!item) return;
  const totalQty = Number(item.totalQuantity) || 1;
  const peopleWithConsumption = state.people.filter((p) => {
    const val = Number(item.consumptions[p.id]) || 0;
    return val > 0;
  });
  if (!peopleWithConsumption.length) {
    alert("Select at least one person first by entering a quantity > 0 for them.");
    return;
  }
  const splitAmount = totalQty / peopleWithConsumption.length;
  peopleWithConsumption.forEach((p) => {
    item.consumptions[p.id] = splitAmount;
  });
  state.people.forEach((p) => {
    if (!peopleWithConsumption.find((pc) => pc.id === p.id)) {
      item.consumptions[p.id] = 0;
    }
  });
  persistState();
  renderConsumptionTable();
  renderResults();
}

function getChargeParticipants(charge) {
  if (Array.isArray(charge.participantIds) && charge.participantIds.length) return charge.participantIds;
  return state.people.map((p) => p.id);
}

function setChargeParticipant(chargeId, personId, include) {
  const charge = state.sharedCharges.find((c) => c.id === chargeId);
  if (!charge) return;
  if (!Array.isArray(charge.participantIds)) {
    charge.participantIds = state.people.map((p) => p.id);
  }
  if (include) {
    if (!charge.participantIds.includes(personId)) {
      charge.participantIds.push(personId);
    }
  } else {
    charge.participantIds = charge.participantIds.filter((id) => id !== personId);
  }
  persistState();
  renderResults();
}

function computeTotals() {
  const perPerson = state.people.map((person) => {
    let subtotal = 0;
    state.items.forEach((item) => {
      const unit = item.totalQuantity ? item.totalPrice / item.totalQuantity : 0;
      const qty = Number(item.consumptions[person.id]) || 0;
      subtotal += unit * qty;
    });
    return { id: person.id, name: person.name, itemSubtotal: subtotal, sharedCharges: 0 };
  });

  const perPersonById = Object.fromEntries(perPerson.map((p) => [p.id, p]));

  let totalShared = 0;
  let varianceInShared = false;
  state.sharedCharges.forEach((charge) => {
    const amount = Number(charge.amount) || 0;
    if (!amount) return;
    const participants = getChargeParticipants(charge);
    if (!participants.length) return;
    totalShared += amount;
    const split = amount / participants.length;
    participants.forEach((pid) => {
      const target = perPersonById[pid];
      if (target) target.sharedCharges += split;
    });
  });

  const baselineShared = perPerson.length ? perPerson[0].sharedCharges : 0;
  varianceInShared = perPerson.some((p) => Math.abs(p.sharedCharges - baselineShared) > 0.0001);

  perPerson.forEach((p) => {
    p.finalTotal = p.itemSubtotal + p.sharedCharges;
  });

  const calculatedTotal = perPerson.reduce((s, p) => s + p.finalTotal, 0);
  const paidTotal = state.paidTotal;
  const difference = paidTotal != null ? paidTotal - calculatedTotal : null;

  return { perPerson, totalShared, calculatedTotal, paidTotal, difference, varianceInShared };
}

function consumptionStats() {
  return state.items.map((item) => {
    const consumed = state.people.reduce((sum, p) => sum + (Number(item.consumptions[p.id]) || 0), 0);
    const total = Number(item.totalQuantity) || 0;
    const delta = total - consumed;
    return { id: item.id, label: item.label, total, consumed, delta };
  });
}

function renderPeople() {
  selectors.peopleChips.innerHTML = "";
  if (!state.people.length) {
    selectors.peopleChips.innerHTML = `<p class="muted">No people yet. Add someone above.</p>`;
    return;
  }
  state.people.forEach((person) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `<span>${person.name}</span>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "✕";
    btn.addEventListener("click", () => removePerson(person.id));
    chip.appendChild(btn);
    selectors.peopleChips.appendChild(chip);
  });
}

function renderItems() {
  selectors.itemsList.innerHTML = "";
  if (!state.items.length) {
    selectors.itemsList.innerHTML = `<p class="muted">No items yet. Add one above.</p>`;
    return;
  }
  state.items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "list-item";
    const unit = item.totalQuantity ? item.totalPrice / item.totalQuantity : 0;
    const typeLabel = item.itemType === "shared" ? " (Shared dish)" : "";
    const qtyLabel = item.itemType === "shared" ? "Portions" : "Qty";
    div.innerHTML = `
      <div>
        <strong>${item.label}${typeLabel}</strong>
        <p class="muted">Total: $${formatCurrency(item.totalPrice)} · ${qtyLabel}: ${formatCurrency(item.totalQuantity)} · Unit: $${formatCurrency(unit)}</p>
      </div>
    `;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ghost";
    btn.textContent = "Delete";
    btn.addEventListener("click", () => removeItem(item.id));
    div.appendChild(btn);
    selectors.itemsList.appendChild(div);
  });
}

function renderSharedCharges() {
  selectors.chargesList.innerHTML = "";
  if (!state.sharedCharges.length) {
    selectors.chargesList.innerHTML = `<p class="muted">No shared charges yet.</p>`;
    return;
  }
  state.sharedCharges.forEach((charge) => {
    const div = document.createElement("div");
    div.className = "list-item";
    const participants = getChargeParticipants(charge);
    div.innerHTML = `
      <div>
        <strong>${charge.label}</strong>
        <p class="muted">$${formatCurrency(charge.amount)} · Select who pays</p>
      </div>
    `;
    const peopleBox = document.createElement("div");
    peopleBox.className = "person-checkboxes";
    if (!state.people.length) {
      peopleBox.innerHTML = `<p class="muted">Add people to split this charge.</p>`;
    } else {
      state.people.forEach((person) => {
        const label = document.createElement("label");
        label.className = "check-pill";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = participants.includes(person.id);
        input.addEventListener("change", (e) => setChargeParticipant(charge.id, person.id, e.target.checked));
        const span = document.createElement("span");
        span.textContent = person.name;
        label.appendChild(input);
        label.appendChild(span);
        peopleBox.appendChild(label);
      });
    }
    div.appendChild(peopleBox);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ghost";
    btn.textContent = "Delete";
    btn.addEventListener("click", () => removeSharedCharge(charge.id));
    div.appendChild(btn);
    selectors.chargesList.appendChild(div);
  });
}

function renderConsumptionTable(focusInfo = null) {
  const table = selectors.consumptionTable;
  table.innerHTML = "";
  if (!state.items.length) {
    table.innerHTML = `<tr><td class="muted">Add items to start tracking consumption.</td></tr>`;
    return;
  }
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const headers = ["Item", "Unit price", "Total qty", "Consumed", "Remaining", ...state.people.map((p) => p.name)];
  const hasSharedItems = state.items.some((it) => it.itemType === "shared");
  if (hasSharedItems) headers.push("Actions");
  headers.forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  state.items.forEach((item) => {
    const unit = item.totalQuantity ? item.totalPrice / item.totalQuantity : 0;
    const consumed = state.people.reduce((sum, p) => sum + (Number(item.consumptions[p.id]) || 0), 0);
    const remaining = (Number(item.totalQuantity) || 0) - consumed;
    const warning = Math.abs(remaining) > 0.0001;
    const isShared = item.itemType === "shared";
    const qtyLabel = isShared ? "Portions" : "Total qty";
    const row = document.createElement("tr");
    if (warning) row.classList.add("row-warning");
    const firstCell = document.createElement("td");
    firstCell.innerHTML = `${item.label}${isShared ? ' <span class="badge">Shared</span>' : ''}`;
    row.appendChild(firstCell);
    
    const unitCell = document.createElement("td");
    unitCell.textContent = `$${formatCurrency(unit)}`;
    row.appendChild(unitCell);
    
    const qtyCell = document.createElement("td");
    qtyCell.textContent = formatNumber(item.totalQuantity);
    row.appendChild(qtyCell);
    
    const consumedCell = document.createElement("td");
    consumedCell.textContent = formatNumber(consumed);
    row.appendChild(consumedCell);
    
    const remainingCell = document.createElement("td");
    remainingCell.textContent = formatNumber(remaining);
    if (warning) remainingCell.classList.add("warning");
    row.appendChild(remainingCell);
    state.people.forEach((person) => {
      const cell = document.createElement("td");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "any";
      input.value = item.consumptions[person.id] ?? 0;
      input.dataset.itemId = item.id;
      input.dataset.personId = person.id;
      input.addEventListener("input", (e) => onConsumptionChange(item.id, person.id, e.target.value));
      cell.appendChild(input);
      row.appendChild(cell);
    });
    if (isShared) {
      const actionCell = document.createElement("td");
      actionCell.className = "action-cell";
      const splitBtn = document.createElement("button");
      splitBtn.type = "button";
      splitBtn.className = "btn-small";
      splitBtn.textContent = "Split equally";
      splitBtn.title = "Auto-distribute equally among people with consumption > 0";
      splitBtn.addEventListener("click", () => splitItemEqually(item.id));
      actionCell.appendChild(splitBtn);
      row.appendChild(actionCell);
    }
    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);

  const issues = consumptionStats().filter((s) => Math.abs(s.delta) > 0.0001);
  if (issues.length) {
    const tfoot = document.createElement("tfoot");
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 5 + state.people.length;
    td.className = "warning";
    const detail = issues.map((i) => `${i.label}: ${formatNumber(i.delta)} remaining`).join("; ");
    td.textContent = `Consumption must sum to item quantity. Fix: ${detail}`;
    tr.appendChild(td);
    tfoot.appendChild(tr);
    table.appendChild(tfoot);
  }

  restoreConsumptionFocus(focusInfo);
}

function renderResults() {
  const results = computeTotals();
  const table = selectors.resultsTable;
  table.innerHTML = "";
  if (!state.people.length) {
    table.innerHTML = `<tr><td class="muted">Add at least one person to see results.</td></tr>`;
    selectors.resultsSummary.innerHTML = "";
    return;
  }

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ["Person", "Item subtotal", "Shared charges", "Final total"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);

  const tbody = document.createElement("tbody");
  const issues = consumptionStats().filter((s) => Math.abs(s.delta) > 0.0001);
  if (issues.length) {
    const row = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 4;
    td.className = "warning";
    const detail = issues.map((i) => `${i.label}: ${formatNumber(i.delta)} remaining`).join("; ");
    td.textContent = `Fix consumption totals before calculating: ${detail}`;
    row.appendChild(td);
    tbody.appendChild(row);
    table.appendChild(thead);
    table.appendChild(tbody);
    selectors.resultsSummary.innerHTML = `<div class="warning">Consumption totals do not match item quantities. Adjust inputs above.</div>`;
    return;
  } else {
    results.perPerson.forEach((p) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${p.name}</td>
        <td>$${formatCurrency(p.itemSubtotal)}</td>
        <td>$${formatCurrency(p.sharedCharges)}</td>
        <td><strong>$${formatCurrency(p.finalTotal)}</strong></td>
      `;
      tbody.appendChild(row);
    });
    table.appendChild(thead);
    table.appendChild(tbody);
  }

  const summaryLines = [
    `<div><strong>Calculated total:</strong> $${formatCurrency(results.calculatedTotal)}</div>`,
    `<div><strong>Actual paid:</strong> ${results.paidTotal != null ? `$${formatCurrency(results.paidTotal)}` : "—"}</div>`,
  ];
  if (results.difference != null) {
    const diff = results.difference;
    const abs = Math.abs(diff);
    const statusClass = abs < 0.05 ? "success" : "warning";
    const message = abs < 0.05 ? "Likely rounding difference" : "Mismatch detected – check input values";
    summaryLines.push(`<div><strong>Difference:</strong> $${formatCurrency(diff)}</div>`);
    summaryLines.push(`<div class="${statusClass}">${message}</div>`);
  } else {
    summaryLines.push(`<div class="muted">Enter the actual amount paid to compare.</div>`);
  }
  const sharedNote = results.varianceInShared
    ? `Shared charges total: $${formatCurrency(results.totalShared)} (varies by person)`
    : `Shared charges total: $${formatCurrency(results.totalShared)} (equal split)`;
  summaryLines.push(`<div class="muted">${sharedNote}</div>`);

  selectors.resultsSummary.innerHTML = summaryLines.join("");
}

function copySummary() {
  if (!state.people.length) {
    alert("Add people first.");
    return;
  }
  const { perPerson } = computeTotals();
  const lines = perPerson.map((p) => `${p.name}: ${formatCurrency(p.finalTotal)}`);
  navigator.clipboard.writeText(lines.join("\n")).then(
    () => {
      selectors.copyBtn.textContent = "Copied!";
      setTimeout(() => (selectors.copyBtn.textContent = "Copy Splitwise summary"), 1400);
    },
    () => alert("Unable to copy right now.")
  );
}

function renderAll() {
  renderPeople();
  renderItems();
  renderSharedCharges();
  renderConsumptionTable();
  renderResults();
}

function captureConsumptionFocus() {
  const el = document.activeElement;
  if (!el || el.tagName !== "INPUT") return null;
  const { itemId, personId } = el.dataset || {};
  if (!itemId || !personId) return null;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  return { itemId, personId, start, end };
}

function restoreConsumptionFocus(focusInfo) {
  if (!focusInfo) return;
  const { itemId, personId, start, end } = focusInfo;
  const selector = `input[data-item-id="${itemId}"][data-person-id="${personId}"]`;
  const input = document.querySelector(selector);
  if (input) {
    input.focus();
    if (start != null && end != null && input.setSelectionRange) {
      const len = input.value.length;
      const s = Math.min(start, len);
      const e = Math.min(end, len);
      input.setSelectionRange(s, e);
    }
  }
}

function initEventHandlers() {
  selectors.peopleForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addPerson(selectors.personName.value);
    selectors.personName.value = "";
  });

  selectors.itemForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addItem({
      label: selectors.itemLabel.value,
      totalPrice: selectors.itemPrice.value,
      totalQuantity: selectors.itemQty.value,
      itemType: selectors.itemSharedDish.checked ? "shared" : "units",
    });
    selectors.itemLabel.value = "";
    selectors.itemPrice.value = "";
    selectors.itemQty.value = "";
    selectors.itemSharedDish.checked = false;
    updateQuantityLabel();
  });

  selectors.itemSharedDish.addEventListener("change", updateQuantityLabel);

  function updateQuantityLabel() {
    const isShared = selectors.itemSharedDish.checked;
    selectors.quantityLabel.textContent = isShared ? "Total portions" : "Total quantity";
    selectors.quantityHelp.textContent = isShared
      ? "(usually 1 for a single shared dish)"
      : "(e.g. 15 units in a pack)";
  }

  selectors.chargeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    addSharedCharge({ label: selectors.chargeLabel.value, amount: selectors.chargeAmount.value });
    selectors.chargeLabel.value = "";
    selectors.chargeAmount.value = "";
  });

  selectors.paidTotal.addEventListener("input", (e) => {
    updatePaidTotal(e.target.value);
    renderResults();
  });

  selectors.calculateBtn.addEventListener("click", () => renderResults());
  selectors.copyBtn.addEventListener("click", copySummary);
}

function restoreInputsFromState() {
  if (state.paidTotal != null) {
    selectors.paidTotal.value = state.paidTotal;
  }
}

function main() {
  initEventHandlers();
  restoreInputsFromState();
  if (selectors.quantityLabel) {
    const updateQuantityLabel = () => {
      const isShared = selectors.itemSharedDish.checked;
      selectors.quantityLabel.textContent = isShared ? "Total portions" : "Total quantity";
      selectors.quantityHelp.textContent = isShared
        ? "(usually 1 for a single shared dish)"
        : "(e.g. 15 units in a pack)";
    };
    updateQuantityLabel();
  }
  renderAll();
}

main();

