const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');
const ExcelJS = require('exceljs');
const pdf = require('pdf-parse');

// Configuración de multer
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

const app = express();
app.set('view engine', 'ejs');
app.use(express.static('public'));  // si necesitas CSS/JS estático

// Página principal con el formulario
app.get('/', (req, res) => {
    res.render('index');
});

// Procesar subida: un Excel y varios PDFs
app.post('/process',
    upload.fields([
        { name: 'excel', maxCount: 1 },
        { name: 'pdfs', maxCount: 20 }
    ]),
    async (req, res) => {
        try {
            // 1) Leer Excel y mapear DNI → { totalNeto, colaborador }
            const excelPath = req.files.excel[0].path;
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(excelPath);

            // Seleccionamos la hoja "Sueldos"
            const sheet = workbook.getWorksheet('Sueldos');
            if (!sheet) {
                throw new Error('La hoja "Sueldos" no existe en el Excel.');
            }

            // Encontrar la fila que contiene "Sueldos" en la columna A
            let markerRowNum = null;
            for (let i = 1; i <= sheet.rowCount; i++) {
                const cellVal = sheet.getRow(i).getCell(1).value;
                if (String(cellVal || '').trim() === 'SUELDOS') {
                    markerRowNum = i;
                    break;
                }
            }
            if (markerRowNum === null) {
                throw new Error('No se encontró la fila de marcador "Sueldos" en la columna A.');
            }

            const headerRow = sheet.getRow(markerRowNum);
            const headers = headerRow.values;

            const colDni = headers.findIndex(h => h === 'DNI');
            const colTotal = headers.findIndex(h => h === 'Total neto ');
            const colColaborador = headers.findIndex(h => h === 'Colaborador');

            if (colDni < 1) throw new Error('No se encontró columna "DNI" en encabezados.');
            if (colTotal < 1) throw new Error('No se encontró columna "Total neto " en encabezados.');
            if (colColaborador < 1) throw new Error('No se encontró columna "Colaborador" en encabezados.');

            // Rellenamos el mapa saltando filas ≤ markerRowNum
            const mapaExcel = new Map();
            sheet.eachRow((row, idx) => {
                if (idx <= markerRowNum) return;
                const dniCell = row.getCell(colDni).value;
                const totCell = row.getCell(colTotal).value;
                if (!dniCell || totCell == null) return;

                const dni = String(dniCell).trim();
                const totalNeto = Math.round(parseFloat(totCell) * 100) / 100;
                const colaborador = row.getCell(colColaborador).value || '';

                mapaExcel.set(dni, { totalNeto, colaborador });
            });

            // 2) Procesar cada PDF y comparar
            const results = [];
            for (const f of req.files.pdfs) {
                const dataBuffer = fs.readFileSync(f.path);
                const data = await pdf(dataBuffer);
                const text = data.text;

                // Extraer CUIL → DNI
                const cuilm = text.match(/CUIL\s*[:\-]?\s*(\d{11})/);
                const dni = cuilm ? cuilm[1].substr(2, 8) : null;

                // Extraer Neto a Cobrar
                const netom = text.match(/Neto a Cobrar\s*:\s*\$\s*([\d\.,]+)/i);
                const raw = netom
                    ? parseFloat(netom[1].replace(/\./g, '').replace(',', '.'))
                    : NaN;
                const netoPdf = Math.round(raw * 100) / 100;

                let status, netoExcel, colaborador;
                if (!dni || isNaN(netoPdf)) {
                    status = '❌ Dato PDF incompleto';
                    colaborador = '-';
                } else if (!mapaExcel.has(dni)) {
                    status = '❌ DNI no encontrado en Excel';
                    colaborador = '-';
                } else {
                    const entry = mapaExcel.get(dni);
                    netoExcel = entry.totalNeto;
                    colaborador = entry.colaborador;
                    const diff = Math.abs(netoExcel - netoPdf);

                    if (diff === 0) {
                        status = '✅ Coincide';
                    } else if (diff <= 100) {
                        status = '🟡 Coincide parcialmente';
                    } else {
                        status = '❌ No coincide';
                    }
                }

                results.push({
                    file: path.basename(f.originalname),
                    dni: dni || '-',
                    colaborador: colaborador || '-',
                    netoPdf: isNaN(netoPdf) ? '-' : netoPdf.toFixed(2),
                    netoExcel: netoExcel != null ? netoExcel.toFixed(2) : '-',
                    status
                });
            }

            // 3) Renderizar resultados
            res.render('result', { results });

        } catch (err) {
            console.error(err);
            res.status(500).send('Error interno: ' + err.message);
        }
    }

);

app.listen(3000, () => {
    console.log('🚀 Servidor en http://localhost:3000');
});
