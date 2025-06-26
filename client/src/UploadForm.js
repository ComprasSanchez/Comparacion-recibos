import { useRef } from 'react';

export default function UploadForm({ onSubmit }) {
    const excelRef = useRef();
    const pdfsRef = useRef();

    const handleSubmit = e => {
        e.preventDefault();
        const formData = new FormData();
        if (excelRef.current.files.length === 0) return alert('Subí un Excel');
        formData.append('excel', excelRef.current.files[0]);
        Array.from(pdfsRef.current.files).forEach(f => {
            formData.append('pdfs', f);
        });
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 handlesubmit">
            <div className="form-group">
                <label className="form-label">Excel:</label>
                <input
                    type="file"
                    accept=".xlsx"
                    ref={excelRef}
                    required
                    className="file-input"
                />
            </div>
            <div className="form-group">
                <label className="form-label">Recibos (PDF):</label>
                <input
                    type="file"
                    accept=".pdf"
                    ref={pdfsRef}
                    multiple
                    required
                    className="file-input"
                />
            </div>
            <button
                type="submit"
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
                Procesar
            </button>
        </form>
    );
}
