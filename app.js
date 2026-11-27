document.addEventListener("DOMContentLoaded", () => {
    // DOM-Elemente
    const monthPicker = document.getElementById("monthPicker");
    const startBalanceInput = document.getElementById("startBalanceInput");
    const displayStartBalanceEl = document.getElementById("displayStartBalance");
    const daysGrid = document.getElementById("daysGrid");
    const selectedDayTitle = document.getElementById("selectedDayTitle");
    const transactionForm = document.getElementById("transactionForm");
    const kzInput = document.getElementById("kzInput");
    const amountInput = document.getElementById("amountInput");
    const text1Input = document.getElementById("text1Input");
    const text2Input = document.getElementById("text2Input");
    const submitBtn = document.getElementById("submitBtn");
    const cancelEditBtn = document.getElementById("cancelEditBtn");
    const transactionList = document.getElementById("transactionList");
    const totalBalanceEl = document.getElementById("totalBalance");
    const totalIncomeEl = document.getElementById("totalIncome");
    const totalExpenseEl = document.getElementById("totalExpense");
    const exportPdfBtn = document.getElementById("exportPdfBtn");
    const resetMonthBtn = document.getElementById("resetMonthBtn");

    // Aktuelles Datum initialisieren
    const today = new Date();
    const currentYearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    monthPicker.value = currentYearMonth;

    let selectedDay = today.getDate();
    let editingTransactionId = null;

    // Datenstruktur aus localStorage laden
    let allData = JSON.parse(localStorage.getItem("kassabuch_data")) || {};

    function saveData() {
        localStorage.setItem("kassabuch_data", JSON.stringify(allData));
    }

    function getMonthData() {
        const ym = monthPicker.value;
        if (!allData[ym]) {
            allData[ym] = { startBalance: 0, days: {} };
        } else if (!allData[ym].days) {
            const oldDays = { ...allData[ym] };
            allData[ym] = { startBalance: 0, days: oldDays };
        }
        return allData[ym];
    }

    function getDaysInMonth(yearMonth) {
        const [year, month] = yearMonth.split("-").map(Number);
        return new Date(year, month, 0).getDate();
    }

    // Formatierung ohne Nachkommastellen (nur ganze Euro)
    function formatCurrency(value) {
        return Math.round(value).toLocaleString("de-AT", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }) + " €";
    }

    // Bearbeitungsmodus beenden und Formular zurücksetzen
    function exitEditMode() {
        editingTransactionId = null;
        transactionForm.reset();
        document.querySelector('input[name="type"][value="income"]').checked = true;
        submitBtn.textContent = "Eintragen";
        submitBtn.classList.remove("editing");
        cancelEditBtn.hidden = true;
    }

    // UI komplett neu zeichnen
    function renderAll() {
        const monthData = getMonthData();
        const roundedStart = Math.round(Number(monthData.startBalance) || 0);
        startBalanceInput.value = roundedStart !== 0 ? roundedStart : "";
        
        renderDaysGrid();
        renderDayTransactions();
        updateTotals();
    }

    // Tage 1 bis 28/30/31 rendern
    function renderDaysGrid() {
        daysGrid.innerHTML = "";
        const daysCount = getDaysInMonth(monthPicker.value);
        const monthData = getMonthData();

        if (selectedDay > daysCount) {
            selectedDay = daysCount;
        }

        for (let day = 1; day <= daysCount; day++) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "day-btn";
            btn.textContent = day;

            if (day === selectedDay) {
                btn.classList.add("active");
            }

            if (monthData.days[day] && monthData.days[day].length > 0) {
                btn.classList.add("has-entries");
            }

            btn.addEventListener("click", () => {
                exitEditMode();
                selectedDay = day;
                renderAll();
            });

            daysGrid.appendChild(btn);
        }

        const [year, month] = monthPicker.value.split("-");
        selectedDayTitle.textContent = `Buchungen für den ${String(selectedDay).padStart(2, "0")}.${month}.${year}`;
    }

    // Liste der Buchungen des gewählten Tages anzeigen
    function renderDayTransactions() {
        transactionList.innerHTML = "";
        const monthData = getMonthData();
        const entries = monthData.days[selectedDay] || [];

        if (entries.length === 0) {
            transactionList.innerHTML = `<li class="empty-state">Keine Einträge für diesen Tag vorhanden.</li>`;
            return;
        }

        entries.forEach((entry) => {
            const li = document.createElement("li");
            li.className = `transaction-item ${entry.type}`;
            if (entry.id === editingTransactionId) {
                li.classList.add("is-editing");
            }

            const kzValue = entry.kz || entry.desc || "";
            const t1 = entry.text1 || "";
            const t2 = entry.text2 || "";

            let subtextsHtml = "";
            if (t1 || t2) {
                subtextsHtml += `<div class="item-subtexts">`;
                if (t1) subtextsHtml += `<span class="subtext-badge"><strong>Text 1:</strong> ${escapeHtml(t1)}</span>`;
                if (t2) subtextsHtml += `<span class="subtext-badge"><strong>Text 2:</strong> ${escapeHtml(t2)}</span>`;
                subtextsHtml += `</div>`;
            }

            const sign = entry.type === "income" ? "+" : "-";
            li.innerHTML = `
                <div class="item-left">
                    <span class="item-kz">KZ: ${escapeHtml(kzValue)}</span>
                    ${subtextsHtml}
                </div>
                <div class="item-right">
                    <span class="item-amount ${entry.type}">${sign} ${formatCurrency(entry.amount)}</span>
                    <button type="button" class="action-btn edit-btn" title="Eintrag bearbeiten">✎</button>
                    <button type="button" class="action-btn delete-btn" title="Eintrag löschen">&times;</button>
                </div>
            `;

            li.querySelector(".edit-btn").addEventListener("click", () => {
                startEditTransaction(entry);
            });

            li.querySelector(".delete-btn").addEventListener("click", () => {
                deleteTransaction(entry.id);
            });

            transactionList.appendChild(li);
        });
    }

    // Eintrag zum Bearbeiten ins Formular laden
    function startEditTransaction(entry) {
        editingTransactionId = entry.id;

        const radio = document.querySelector(`input[name="type"][value="${entry.type}"]`);
        if (radio) radio.checked = true;

        kzInput.value = entry.kz || entry.desc || "";
        amountInput.value = Math.round(Number(entry.amount) || 0);
        text1Input.value = entry.text1 || "";
        text2Input.value = entry.text2 || "";

        submitBtn.textContent = "Änderungen speichern";
        submitBtn.classList.add("editing");
        cancelEditBtn.hidden = false;

        kzInput.focus();
        renderDayTransactions();
    }

    // Bearbeitung abbrechen
    cancelEditBtn.addEventListener("click", () => {
        exitEditMode();
        renderDayTransactions();
    });

    // Gesamtsummen & Kassastand oben aktualisieren
    function updateTotals() {
        const monthData = getMonthData();
        const startBalance = Math.round(Number(monthData.startBalance) || 0);
        let income = 0;
        let expense = 0;

        Object.values(monthData.days).forEach((dayEntries) => {
            dayEntries.forEach((entry) => {
                const roundedAmount = Math.round(Number(entry.amount) || 0);
                if (entry.type === "income") {
                    income += roundedAmount;
                } else {
                    expense += roundedAmount;
                }
            });
        });

        const balance = startBalance + income - expense;

        displayStartBalanceEl.textContent = formatCurrency(startBalance);
        totalIncomeEl.textContent = formatCurrency(income);
        totalExpenseEl.textContent = formatCurrency(expense);
        totalBalanceEl.textContent = formatCurrency(balance);

        if (balance < 0) {
            totalBalanceEl.classList.add("negative");
        } else {
            totalBalanceEl.classList.remove("negative");
        }
    }

    // Änderung des Anfangsbestands live speichern & berechnen (nur ganze Euro)
    startBalanceInput.addEventListener("input", () => {
        const monthData = getMonthData();
        const val = parseInt(startBalanceInput.value, 10);
        monthData.startBalance = isNaN(val) ? 0 : val;
        saveData();
        updateTotals();
    });

    // Neuen Eintrag hinzufügen ODER bestehenden Eintrag aktualisieren
    transactionForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const type = document.querySelector('input[name="type"]:checked').value;
        const kz = kzInput.value.trim();
        const amount = Math.round(parseFloat(amountInput.value));
        const text1 = text1Input.value.trim();
        const text2 = text2Input.value.trim();

        if (!kz || isNaN(amount) || amount <= 0) return;

        const monthData = getMonthData();
        if (!monthData.days[selectedDay]) {
            monthData.days[selectedDay] = [];
        }

        if (editingTransactionId !== null) {
            const index = monthData.days[selectedDay].findIndex((item) => item.id === editingTransactionId);
            if (index !== -1) {
                monthData.days[selectedDay][index] = {
                    ...monthData.days[selectedDay][index],
                    type,
                    kz,
                    text1,
                    text2,
                    amount
                };
            }
            exitEditMode();
        } else {
            monthData.days[selectedDay].push({
                id: Date.now(),
                type,
                kz,
                text1,
                text2,
                amount
            });
            kzInput.value = "";
            amountInput.value = "";
            text1Input.value = "";
            text2Input.value = "";
        }

        saveData();
        kzInput.focus();
        renderAll();
    });

    // Eintrag löschen
    function deleteTransaction(id) {
        const monthData = getMonthData();
        if (!monthData.days[selectedDay]) return;

        if (editingTransactionId === id) {
            exitEditMode();
        }

        monthData.days[selectedDay] = monthData.days[selectedDay].filter((item) => item.id !== id);
        saveData();
        renderAll();
    }

    // Monatswechsel
    monthPicker.addEventListener("change", () => {
        exitEditMode();
        selectedDay = 1;
        renderAll();
    });

    // Aktuellen Monat zurücksetzen
    resetMonthBtn.addEventListener("click", () => {
        const ym = monthPicker.value;
        if (confirm(`Möchtest du wirklich alle Einträge und den Anfangsbestand für ${ym} unwiderruflich löschen?`)) {
            exitEditMode();
            allData[ym] = { startBalance: 0, days: {} };
            saveData();
            renderAll();
        }
    });

    // PDF-Monatsabschluss erstellen
    exportPdfBtn.addEventListener("click", () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const ym = monthPicker.value;
        const [year, month] = ym.split("-");
        const monthNames = [
            "Jänner", "Februar", "März", "April", "Mai", "Juni",
            "Juli", "August", "September", "Oktober", "November", "Dezember"
        ];
        const monthName = monthNames[parseInt(month, 10) - 1];
        const monthData = getMonthData();

        const startBalance = Math.round(Number(monthData.startBalance) || 0);
        let totalIncome = 0;
        let totalExpense = 0;
        let runningBalance = startBalance;

        const rows = [
            [
                `01.${month}.${year}`,
                "Anfangsbestand",
                "Übertrag Monatsbeginn",
                "",
                "",
                "",
                formatCurrency(startBalance)
            ]
        ];

        const daysCount = getDaysInMonth(ym);
        for (let day = 1; day <= daysCount; day++) {
            const entries = monthData.days[day] || [];
            entries.forEach((entry) => {
                const dateStr = `${String(day).padStart(2, "0")}.${month}.${year}`;
                const kzValue = entry.kz || entry.desc || "";
                const t1 = entry.text1 || "";
                const t2 = entry.text2 || "";
                const roundedAmount = Math.round(Number(entry.amount) || 0);

                if (entry.type === "income") {
                    totalIncome += roundedAmount;
                    runningBalance += roundedAmount;
                    rows.push([
                        dateStr,
                        kzValue,
                        t1,
                        t2,
                        formatCurrency(roundedAmount),
                        "",
                        formatCurrency(runningBalance)
                    ]);
                } else {
                    totalExpense += roundedAmount;
                    runningBalance -= roundedAmount;
                    rows.push([
                        dateStr,
                        kzValue,
                        t1,
                        t2,
                        "",
                        formatCurrency(roundedAmount),
                        formatCurrency(runningBalance)
                    ]);
                }
            });
        }

        if (rows.length === 1 && startBalance === 0) {
            alert("Für diesen Monat sind noch keine Daten vorhanden.");
            return;
        }

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(`Bargeld-Monatsabschluss: ${monthName} ${year}`, 14, 22);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-AT")}`, 14, 29);

        doc.autoTable({
            startY: 36,
            head: [["Datum", "KZ", "Text 1", "Text 2", "Einnahme", "Ausgabe", "Kassastand"]],
            body: rows,
            theme: "striped",
            headStyles: { fillColor: [30, 41, 59] },
            columnStyles: {
                4: { halign: "right", textColor: [16, 185, 129] },
                5: { halign: "right", textColor: [239, 68, 68] },
                6: { halign: "right", fontStyle: "bold" }
            },
            styles: { fontSize: 8.5 }
        });

        const finalY = doc.lastAutoTable.finalY + 12;
        doc.setTextColor(0);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Anfangsbestand: ${formatCurrency(startBalance)}`, 14, finalY);
        doc.text(`Summe Einnahmen: ${formatCurrency(totalIncome)}`, 14, finalY + 7);
        doc.text(`Summe Ausgaben: ${formatCurrency(totalExpense)}`, 14, finalY + 14);

        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(`End-Kassastand: ${formatCurrency(runningBalance)}`, 14, finalY + 23);

        doc.save(`Kassabuch_${year}_${month}.pdf`);
    });

    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    renderAll();
});