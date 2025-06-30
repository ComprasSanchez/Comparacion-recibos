const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const pdf = require('pdf-parse');

const app = express();

// 1) Multer para subidas
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// 2) Servir el build de React
app.use(express.static(path.join(__dirname, 'client/build')));

// 3) API: procesar Excel + PDFs y devolver JSON
app.post(
    '/process',
    upload.fields([
        { name: 'excel', maxCount: 1 },
        { name: 'pdfs', maxCount: 1000 }
    ]),
    async (req, res) => {
        try {
            // --- tu lógica de lectura de Excel y PDFs ---
            const excelPath = req.files.excel[0].path;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(excelPath);

            const sheet = workbook.getWorksheet('Sueldos');
            if (!sheet) throw new Error('No existe hoja "Sueldos".');

            // detecta la fila donde A="SUELDOS"
            let markerRow = null;
            for (let i = 1; i <= sheet.rowCount; i++) {
                if (String(sheet.getRow(i).getCell(1).value || '').trim() === 'SUELDOS') {
                    markerRow = i;
                    break;
                }
            }
            if (!markerRow) throw new Error('No se encontró fila con A="SUELDOS".');

            // encabezados en esa misma fila
            const headers = sheet.getRow(markerRow).values;
            const colDni = headers.findIndex(h => h === 'DNI');
            const colTotal = headers.findIndex(h => h === 'Total neto ');
            const colColaborador = headers.findIndex(h => h === 'Colaborador');
            [colDni, colTotal, colColaborador].forEach((c, i) => {
                if (c < 1) throw new Error(
                    ['DNI', 'Total neto ', 'Colaborador'][i] + ' no encontrado en encabezados.'
                );
            });

            // llena el mapa saltando filas ≤ markerRow
            const mapaExcel = new Map();
            sheet.eachRow((row, idx) => {
                if (idx <= markerRow) return;
                const dniCell = row.getCell(colDni).value;
                const totCell = row.getCell(colTotal).value;
                if (!dniCell || totCell == null) return;

                const dni = String(dniCell).trim();
                const totalNeto = Math.round(parseFloat(totCell) * 100) / 100;
                const colaborador = row.getCell(colColaborador).value || '';
                mapaExcel.set(dni, { totalNeto, colaborador });
            });

            // procesa cada PDF
            // 2) Procesar cada PDF y comparar
            const results = [];
            for (const f of req.files.pdfs) {
                let text;
                try {
                    const dataBuffer = fs.readFileSync(f.path);
                    const data = await pdf(dataBuffer);
                    text = data.text;
                } catch (e) {
                    // marca este PDF como fallido y continúa
                    results.push({
                        file: path.basename(f.originalname),
                        dni: '-',
                        colaborador: '-',
                        netoPdf: '-',
                        netoExcel: '-',
                        status: '❌ Controlar Recibo',
                        errorMessage: e.message
                    });
                    continue;
                }

                // si llegamos acá, el PDF se leyó OK:
                const cuilm = text.match(/CUIL\s*[:\-]?\s*(\d{11})/);
                const dni = cuilm ? cuilm[1].substr(2, 8) : null;
                const netom = text.match(/Neto a Cobrar\s*:\s*\$\s*([\d\.,]+)/i);
                const raw = netom
                    ? parseFloat(netom[1].replace(/\./g, '').replace(',', '.'))
                    : NaN;
                const netoPdf = Math.round(raw * 100) / 100;

                let status, netoExcel, colaborador;
                if (!dni || isNaN(netoPdf)) {
                    status = '❌ Controlar Recibo';
                    colaborador = '-';
                } else if (!mapaExcel.has(dni)) {
                    status = '❌ Controlar Recibo';
                    colaborador = '-';
                } else {
                    const entry = mapaExcel.get(dni);
                    netoExcel = entry.totalNeto;
                    colaborador = entry.colaborador;
                    const diff = Math.abs(netoExcel - netoPdf);
                    status = diff === 0
                        ? '✅ Coincide'
                        : diff <= 100
                            ? '🟡 Coincide parcialmente'
                            : '❌ Leído, NO coincide';
                }

                results.push({
                    file: path.basename(f.originalname),
                    dni: dni || '-',
                    colaborador,
                    netoPdf: isNaN(netoPdf) ? '-' : netoPdf.toFixed(2),
                    netoExcel: netoExcel != null ? netoExcel.toFixed(2) : '-',
                    status
                });
            }

            // RESPUESTA JSON
            return res.json({ results });

        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
    }
);

// 4) Catch-all para servir React en rutas GET
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// 5) Levantar servidor
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
});
