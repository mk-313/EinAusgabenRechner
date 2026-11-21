document.addEventListener("DOMContentLoaded", () => {
    // DOM-Elemente
    const monthPicker = document.getElementById("monthPicker");
    const daysGrid = document.getElementById("daysGrid");
    const selectedDayTitle = document.getElementById("selectedDayTitle");
    const transactionForm = document.getElementById("transactionForm");
    const descriptionInput = document.getElementById("descriptionInput");
    const amountInput = document.getElementById("amountInput");
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

    // Datenstruktur aus localStorage laden: { "2026-11": { "1": [ {id, type, desc, amount} ], ... } }
    let allData = JSON.parse(localStorage.getItem("kassabuch_data")) || {};

    function saveData() {
        localStorage.setItem("kassabuch_data", JSON.stringify(allData));
    }

    function getMonthData() {
        const ym = monthPicker.value;
        if (!allData[ym]) {
            allData[ym] = {};
        }
        return allData[ym];
    }

    function getDaysInMonth(yearMonth) {
        const [year, month] = yearMonth.split("-").map(Number);
        return new Date(year, month, 0).getDate();
    }

    function formatCurrency(value) {
        return value.toLocaleString("de-AT", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + " €";
    }

    // UI komplett neu zeichnen
    function renderAll() {
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

            if (monthData[day] && monthData[day].length > 0) {
                btn.classList.add("has-entries");
            }

            btn.addEventListener("click", () => {
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
        const entries = monthData[selectedDay] || [];

        if (entries.length === 0) {
            transactionList.innerHTML = `<li class="empty-state">Keine Einträge für diesen Tag vorhanden.</li>`;
            return;
        }

        entries.forEach((entry) => {
            const li = document.createElement("li");
            li.className = `transaction-item ${entry.type}`;

            const sign = entry.type === "income" ? "+" : "-";
            li.innerHTML = `
                <span class="item-desc">${escapeHtml(entry.desc)}</span>
                <div class="item-right">
                    <span class="item-amount ${entry.type}">${sign} ${formatCurrency(entry.amount)}</span>
                    <button type="button" class="delete-btn" title="Eintrag löschen">&times;</button>
                </div>
            `;

            li.querySelector(".delete-btn").addEventListener("click", () => {
                deleteTransaction(entry.id);
            });

            transactionList.appendChild(li);
        });
    }

    // Gesamtsummen & Kassastand oben aktualisieren
    function updateTotals() {
        const monthData = getMonthData();
        let income = 0;
        let expense = 0;

        Object.values(monthData).forEach((dayEntries) => {
            dayEntries.forEach((entry) => {
                if (entry.type === "income") {
                    income += entry.amount;
                } else {
                    expense += entry.amount;
                }
            });
        });

        const balance = income - expense;

        totalIncomeEl.textContent = formatCurrency(income);
        totalExpenseEl.textContent = formatCurrency(expense);
        totalBalanceEl.textContent = formatCurrency(balance);

        if (balance < 0) {
            totalBalanceEl.classList.add("negative");
        } else {
            totalBalanceEl.classList.remove("negative");
        }
    }

    // Neuen Eintrag hinzufügen
    transactionForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const type = document.querySelector('input[name="type"]:checked').value;
        const desc = descriptionInput.value.trim();
        const amount = parseFloat(amountInput.value);

        if (!desc || isNaN(amount) || amount <= 0) return;

        const monthData = getMonthData();
        if (!monthData[selectedDay]) {
            monthData[selectedDay] = [];
        }

        monthData[selectedDay].push({
            id: Date.now(),
            type,
            desc,
            amount
        });

        saveData();
        descriptionInput.value = "";
        amountInput.value = "";
        descriptionInput.focus();
        renderAll();
    });

    // Eintrag löschen
    function deleteTransaction(id) {
        const monthData = getMonthData();
        if (!monthData[selectedDay]) return;

        monthData[selectedDay] = monthData[selectedDay].filter((item) => item.id !== id);
        saveData();
        renderAll();
    }

    // Monatswechsel
    monthPicker.addEventListener("change", () => {
        selectedDay = 1;
        renderAll();
    });

    // Aktuellen Monat zurücksetzen
    resetMonthBtn.addEventListener("click", () => {
        const ym = monthPicker.value;
        if (confirm(`Möchtest du wirklich alle Einträge für ${ym} unwiderruflich löschen?`)) {
            allData[ym] = {};
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

        // Tabellenzeilen chronologisch von Tag 1 bis 31 aufbauen
        const rows = [];
        let totalIncome = 0;
        let totalExpense = 0;
        let runningBalance = 0;

        const daysCount = getDaysInMonth(ym);
        for (let day = 1; day <= daysCount; day++) {
            const entries = monthData[day] || [];
            entries.forEach((entry) => {
                const dateStr = `${String(day).padStart(2, "0")}.${month}.${year}`;
                if (entry.type === "income") {
                    totalIncome += entry.amount;
                    runningBalance += entry.amount;
                    rows.push([
                        dateStr,
                        entry.desc,
                        formatCurrency(entry.amount),
                        "",
                        formatCurrency(runningBalance)
                    ]);
                } else {
                    totalExpense += entry.amount;
                    runningBalance -= entry.amount;
                    rows.push([
                        dateStr,
                        entry.desc,
                        "",
                        formatCurrency(entry.amount),
                        formatCurrency(runningBalance)
                    ]);
                }
            });
        }

        if (rows.length === 0) {
            alert("Für diesen Monat sind noch keine Buchungen vorhanden.");
            return;
        }

        // PDF Header
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(`Bargeld-Monatsabschluss: ${monthName} ${year}`, 14, 22);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.text(`Erstellt am: ${new Date().toLocaleDateString("de-AT")}`, 14, 29);

        // Tabelle rendern
        doc.autoTable({
            startY: 36,
            head: [["Datum", "Bezeichnung", "Einnahme", "Ausgabe", "Kassastand"]],
            body: rows,
            theme: "striped",
            headStyles: { fillColor: [30, 41, 59] },
            columnStyles: {
                2: { halign: "right", textColor: [16, 185, 129] },
                3: { halign: "right", textColor: [239, 68, 68] },
                4: { halign: "right", fontStyle: "bold" }
            },
            styles: { fontSize: 9.5 }
        });

        // Zusammenfassung unter der Tabelle
        const finalY = doc.lastAutoTable.finalY + 12;
        doc.setTextColor(0);
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.text(`Summe Einnahmen: ${formatCurrency(totalIncome)}`, 14, finalY);
        doc.text(`Summe Ausgaben: ${formatCurrency(totalExpense)}`, 14, finalY + 7);

        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(`End-Kassastand: ${formatCurrency(runningBalance)}`, 14, finalY + 16);

        // Datei speichern
        doc.save(`Kassabuch_${year}_${month}.pdf`);
    });

    // XSS-Schutz für Texteingaben
    function escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML;
    }

    // Start-Render
    renderAll();
});

// Git Kommentar