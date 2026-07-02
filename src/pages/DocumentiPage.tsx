import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import Navbar from "../components/Navbar";

interface Cliente {
  id: number;
  nome: string;
}

interface Documento {
  id: number;
  cliente_id: number | null;
  cliente_nome?: string;
  nome_file: string;
  categoria: string;
  descrizione: string;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
}

const CATEGORIES = [
  { value: "contratto", label: "Contratto" },
  { value: "documento_identita", label: "Documento d'Identità" },
  { value: "preventivo", label: "Preventivo" },
  { value: "fattura", label: "Fattura" },
  { value: "altro", label: "Altro" },
];

export default function DocumentiPage() {
  const queryClient = useQueryClient();
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingDocumento, setEditingDocumento] = useState<Documento | null>(null);
  
  // Filters
  const [clienteIdFilter, setClienteIdFilter] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user?.id;

  // Fetch clients for filter dropdown
  const { data: clienti } = useQuery({
    queryKey: ["clienti", userId],
    queryFn: async () => {
      const response = await fetch(`/api/my/v1/clienti`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data.clienti;
    },
    enabled: !!userId,
  });

  // Fetch documents with filters
  const { data: documenti, isLoading } = useQuery({
    queryKey: ["documenti", userId, clienteIdFilter, categoriaFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (clienteIdFilter) params.append("cliente_id", clienteIdFilter);
      if (categoriaFilter) params.append("categoria", categoriaFilter);
      if (searchTerm) params.append("search", searchTerm);
      
      const response = await fetch(`/api/my/v1/documenti?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data.documenti;
    },
    enabled: !!userId,
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: any) => {
      const response = await fetch(`/api/my/v1/documenti`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documenti"] });
      setShowUploadModal(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/my/v1/documenti/${id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documenti"] });
      setEditingDocumento(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/my/v1/documenti/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documenti"] });
    },
  });

  const handleDownload = async (documento: Documento) => {
    try {
      const response = await fetch(`/api/my/v1/documenti?id=${documento.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok || !data.presigned_url) {
        throw new Error(data.error || "Impossibile scaricare il documento");
      }
      
      // Open in new window or download
      window.open(data.presigned_url, "_blank");
    } catch (err: any) {
      alert(err.message || "Errore nel download del documento");
    }
  };

  const handleEdit = (documento: Documento) => {
    setEditingDocumento(documento);
  };

  const handleDelete = (id: number, nomeFile: string) => {
    if (confirm(`Sei sicuro di voler eliminare il documento "${nomeFile}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseForm = () => {
    setEditingDocumento(null);
    resetForm();
  };

  const resetForm = () => {
    // Reset form state handled by modal component
  };

  const handleClearFilters = () => {
    setClienteIdFilter("");
    setCategoriaFilter("");
    setSearchTerm("");
  };

  if (!userId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p>Devi essere autenticato per visualizzare i documenti.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const categoriaLabel = (cat: string) => {
    return CATEGORIES.find(c => c.value === cat)?.label || cat;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h1 className="text-3xl font-bold">Documenti</h1>
          <Button onClick={() => setShowUploadModal(true)}>
            Carica Documento
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-2">
                <Label htmlFor="search">Ricerca</Label>
                <Input
                  id="search"
                  placeholder="Nome file o descrizione..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cliente_filter">Cliente</Label>
                <select 
                  value={clienteIdFilter} 
                  onChange={(e) => setClienteIdFilter(e.target.value)} 
                  className="w-full p-2 border rounded"
                >
                  <option value="">Tutti i clienti</option>
                  {clienti?.map((c: Cliente) => (
                    <option key={c.id} value={String(c.id)}>{c.nome}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria_filter">Categoria</Label>
                <select 
                  value={categoriaFilter} 
                  onChange={(e) => setCategoriaFilter(e.target.value)} 
                  className="w-full p-2 border rounded"
                >
                  <option value="">Tutte le categorie</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button variant="outline" onClick={handleClearFilters}>
                  Pulisci filtri
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Modal */}
        {showUploadModal && (
          <UploadModal
            clienti={clienti || []}
            onSubmit={(data) => uploadMutation.mutate(data)}
            onClose={() => {
              setShowUploadModal(false);
            }}
          />
        )}

        {/* Edit Modal */}
        {editingDocumento && (
          <EditModal
            documento={editingDocumento}
            onSubmit={(data) => updateMutation.mutate({ id: editingDocumento.id, data })}
            onClose={() => setEditingDocumento(null)}
          />
        )}

        {/* Documents List */}
        {isLoading ? (
          <p>Caricamento...</p>
        ) : documenti?.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p>Nessun documento trovato.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documenti?.map((doc: Documento) => (
              <Card key={doc.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-sm truncate" title={doc.nome_file}>
                      {doc.nome_file}
                    </CardTitle>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {categoriaLabel(doc.categoria)}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {doc.descrizione && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {doc.descrizione}
                    </p>
                  )}
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Cliente:</span>
                      <span className="font-medium">{doc.cliente_nome || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dimensione:</span>
                      <span>{formatSize(doc.size_bytes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Data:</span>
                      <span>{doc.created_at ? new Date(doc.created_at).toLocaleDateString("it-IT") : "-"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleDownload(doc)}
                    >
                      Scarica
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={() => handleEdit(doc)}
                    >
                      Modifica
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleDelete(doc.id, doc.nome_file)}
                    >
                      Elimina
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function UploadModal({ clienti, onSubmit, onClose }: { 
  clienti: Cliente[];
  onSubmit: (data: any) => void;
  onClose: () => void;
}) {
  const [clienteId, setClienteId] = useState("");
  const [categoria, setCategoria] = useState("contratto");
  const [descrizione, setDescrizione] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const ext = "." + selectedFile.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = [".pdf", ".doc", ".docx", ".txt", ".jpg", ".jpeg", ".png", ".gif", ".svg"];
    
    if (!allowedExtensions.includes(ext)) {
      setError(`Tipo di file non supportato: ${ext}. Formati consentiti: PDF, immagini (JPG, PNG, GIF), testo, Word (.doc, .docx)`);
      setFile(null);
      return;
    }

    setError("");
    setFile(selectedFile);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!file) {
      alert("Seleziona un file da caricare");
      return;
    }

    if (!clienteId) {
      alert("Seleziona un cliente");
      return;
    }

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        
        onSubmit({
          cliente_id: parseInt(clienteId),
          categoria,
          descrizione,
          nome_file: file.name,
          content_type: file.type,
          file_data: base64Data.split(",")[1], // Remove data URL prefix
        });
      };
      reader.onerror = () => {
        setError("Errore nella lettura del file");
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setError(err.message || "Errore nel caricamento");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Carica Documento</h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente *</Label>
            <select 
              value={clienteId} 
              onChange={(e) => setClienteId(e.target.value)} 
              className="w-full p-2 border rounded"
              required
            >
              <option value="">Seleziona un cliente</option>
              {clienti.map((c: Cliente) => (
                <option key={c.id} value={String(c.id)}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria *</Label>
            <select 
              value={categoria} 
              onChange={(e) => setCategoria(e.target.value)} 
              className="w-full p-2 border rounded"
              required
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">File *</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.svg"
              onChange={handleFileChange}
              required
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descrizione">Descrizione</Label>
            <Textarea
              id="descrizione"
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Breve descrizione del documento..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">Carica</Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Annulla
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditModal({ documento, onSubmit, onClose }: { 
  documento: Documento;
  onSubmit: (data: any) => void;
  onClose: () => void;
}) {
  const [categoria, setCategoria] = useState(documento.categoria);
  const [descrizione, setDescrizione] = useState(documento.descrizione);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">Modifica Documento</h2>

        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ categoria, descrizione });
        }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit_categoria">Categoria</Label>
            <select 
              value={categoria} 
              onChange={(e) => setCategoria(e.target.value)} 
              className="w-full p-2 border rounded"
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit_descrizione">Descrizione</Label>
            <Textarea
              id="edit_descrizione"
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              placeholder="Breve descrizione del documento..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">Aggiorna</Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Annulla
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token || ""}`,
  };
}
