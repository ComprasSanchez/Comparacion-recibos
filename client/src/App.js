import { useState } from 'react';
import UploadForm from './UploadForm';
import ResultsTable from './ResultsTable';

function App() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ loadedFile: 0, totalFiles: 0 });
  const [filterStatus, setFilterStatus] = useState('Todos');

  const handleSubmit = formData => {
    const totalFiles = formData.getAll('pdfs').length;
    setProgress({ loadedFile: 0, totalFiles });
    setLoading(true);
    setResults(null);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/process');

    xhr.upload.onprogress = event => {
      if (event.lengthComputable) {
        const percent = event.loaded / event.total;
        const fileIndex = Math.min(
          totalFiles,
          Math.ceil(percent * totalFiles)
        );
        setProgress({ loadedFile: fileIndex, totalFiles });
      }
    };

    xhr.onload = () => {
      setLoading(false);
      if (xhr.status === 200) {
        let data;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          return alert('Respuesta inesperada del servidor.');
        }
        setResults(data.results);
        setFilterStatus('Todos');  // reset filtro al cargar nuevos resultados
      } else {
        alert(`Error del servidor: ${xhr.statusText}`);
      }
    };

    xhr.onerror = () => {
      setLoading(false);
      alert('Error de red al enviar los archivos.');
    };

    xhr.send(formData);
  };

  // Genera lista de estados únicos de los resultados
  const statusOptions = results
    ? ['Todos', ...Array.from(new Set(results.map(r => r.status)))]
    : ['Todos'];

  // Filtra antes de pasarlo a la tabla
  const filteredResults = results
    ? (filterStatus === 'Todos'
      ? results
      : results.filter(r => r.status === filterStatus)
    )
    : [];

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Comparador de Recibos</h1>
      <UploadForm onSubmit={handleSubmit} />

      {loading && (
        <p className="mt-4 text-blue-500 text-center">
          🔄 Procesando {progress.loadedFile} de {progress.totalFiles} archivos…
        </p>
      )}

      {results && (
        <>
          {/*  ——— Filtro de Estado ——— */}
          <div className="my-4 flex items-center space-x-2 filter-container">
            <label className="font-semibold">Filtrar Estado:</label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1"
            >
              {statusOptions.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <ResultsTable results={filteredResults} />
        </>
      )}
    </div>
  );
}

export default App;
