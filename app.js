const fs = require('fs');
const pdf = require('pdf-parse');
const ExcelJS = require('exceljs');

async function extractAndCompare() {
    // 1. Leer Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('Cambursano.xlsx');
    const sheet = workbook.worksheets[0];
    const headerRow = sheet.getRow(1);
    const colIndex = {
        dni: headerRow.values.findIndex(v => v === 'DNI'),
        total: headerRow.values.findIndex(v => v === 'Total neto ')
    };
    const excelData = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        excelData.push({
            DNI: row.getCell(colIndex.dni).value,
            TotalNeto: parseFloat(row.getCell(colIndex.total).value)
        });
    });

    // 2. Leer y parsear PDF
    const dataBuffer = fs.readFileSync('20299638457-042025-Mensual.PDF');
    const data = await pdf(dataBuffer);
    const text = data.text;

    // 3. Extraer y recortar CUIL → DNI
    const cuilMatch = text.match(/CUIL\s*[:\-]?\s*(\d{11})/);
    const dniFromCuil = cuilMatch
        ? cuilMatch[1].substr(2, 8)
        : null;

    // 4. Extraer “Neto a Cobrar”
    const netoMatch = text.match(/Neto a Cobrar\s*:\s*\$\s*([\d\.,]+)/i);
    const netoPdfRaw = netoMatch
        ? parseFloat(netoMatch[1].replace(/\./g, '').replace(',', '.'))
        : null;

    if (!dniFromCuil || netoPdfRaw === null) {
        console.error('⚠️ No se pudo extraer todos los datos del PDF');
        return;
    }

    // 5. Redondear a dos decimales
    const netoPdf = Math.round(netoPdfRaw * 100) / 100;
    const registro = excelData.find(r => String(r.DNI) === dniFromCuil);

    if (!registro) {
        console.log(`⚠️ DNI ${dniFromCuil} no encontrado en el Excel`);
        return;
    }
    const netoExcel = Math.round(registro.TotalNeto * 100) / 100;

    console.log(`PDF → DNI: ${dniFromCuil}, Neto: ${netoPdf.toFixed(2)}`);
    console.log(`Excel → DNI: ${registro.DNI}, TotalNeto: ${netoExcel.toFixed(2)}`);

    // 6. Comparar estrictamente dos decimales
    if (netoPdf === netoExcel) {
        console.log(`✅ Montos coinciden (hasta 2 decimales) para DNI ${dniFromCuil}`);
    } else {
        console.log(
            `❌ Montos NO coinciden para DNI ${dniFromCuil}:\n` +
            `    Excel = ${netoExcel.toFixed(2)}\n` +
            `    PDF   = ${netoPdf.toFixed(2)}\n` +
            `    Diferencia = ${(netoExcel - netoPdf).toFixed(2)}`
        );
    }
}

extractAndCompare().catch(console.error);
