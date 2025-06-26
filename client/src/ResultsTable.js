export default function ResultsTable({ results }) {
    return (
        <table className="mt-6 w-full border-collapse">
            <thead>
                <tr className="bg-gray-100">
                    <th className="border px-2 py-1">Archivo</th>
                    <th className="border px-2 py-1">DNI</th>
                    <th className="border px-2 py-1">Colaborador</th>
                    <th className="border px-2 py-1">Neto PDF</th>
                    <th className="border px-2 py-1">Neto Excel</th>
                    <th className="border px-2 py-1">Estado</th>
                </tr>
            </thead>
            <tbody>
                {results.map((r, i) => (
                    <tr key={i}>
                        <td className="border px-2 py-1">{r.file}</td>
                        <td className="border px-2 py-1">{r.dni}</td>
                        <td className="border px-2 py-1">{r.colaborador}</td>
                        <td className="border px-2 py-1">{r.netoPdf}</td>
                        <td className="border px-2 py-1">{r.netoExcel}</td>
                        <td className="border px-2 py-1">{r.status}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
