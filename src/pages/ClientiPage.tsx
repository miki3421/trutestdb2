import { useState, useEffect } from "react";
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
  email: string;
  telefono: string;
  citta: string;
  nota: string;
}

interface Documento {
  id: number;
  cliente_id: number | null;
  nome_file: string;
  categoria: string;
  descrizione: string;
  content_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
}

export default function ClientiPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user?.id;

  const { data: clienti, isLoading } = useQuery({
    queryKey: ["clienti", userId, searchTerm],
    queryFn: async () => {
      const searchParam = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : "";
      const response = await fetch(`/api/my/v1/clienti${searchParam}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data.clienti;
    },
    enabled: !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/my/v1/clienti/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clienti"] });
      setShowForm(false);
      setEditingCliente(null);
    },
  });

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Sei sicuro di voler eliminare questo cliente?")) {
      deleteMutation.mutate(id);
    }
  };

  // Selected client for detail view
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  const { data: documentiCliente, isLoading: loadingDocumenti } = useQuery({
    queryKey: ["documenti_cliente", selectedCliente?.id],
    queryFn: async () => {
      if (!selectedCliente?.id) return [];
      const response = await fetch(`/api/my/v1/documenti?cliente_id=${selectedCliente.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data.documenti;
    },
    enabled: !!selectedCliente?.id,
  });

  const deleteDocumentoMutation = useMutation({
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
      queryClient.invalidateQueries({ queryKey: ["documenti_cliente"] });
    },
  });

  const handleViewDocumenti = (cliente: Cliente) => {
    setSelectedCliente(cliente);
  };

  const handleCloseDocumentoDetail = () => {
    setSelectedCliente(null);
  };

  const handleDeleteDocumento = (id: number, nomeFile: string) => {
    if (confirm(`Sei sicuro di voler eliminare il documento "${nomeFile}"?`)) {
      deleteDocumentoMutation.mutate(id);
    }
  };

  const categoriaLabel = (cat: string) => {
    const categories: Record<string, string> = {
      contratto: "Contratto",
      documento_identita: "Documento d'Identità",
      preventivo: "Preventivo",
      fattura: "Fattura",
      altro: "Altro",
    };
    return categories[cat] || cat;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownloadDocumento = async (documento: Documento) => {
    try {
      const response = await fetch(`/api/my/v1/documenti?id=${documento.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok || !data.presigned_url) {
        throw new Error(data.error || "Impossibile scaricare il documento");
      }
      window.open(data.presigned_url, "_blank");
    } catch (err: any) {
      alert(err.message || "Errore nel download del documento");
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCliente(null);
  };

  if (!userId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p>Devi essere autenticato per visualizzare i clienti.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold">Clienti</h1>
          <Button onClick={() => setShowForm(true)}>
            Nuovo Cliente
          </Button>
        </div>

        {showForm && (
          <ClienteForm
            cliente={editingCliente}
            onClose={handleCloseForm}
          />
        )}

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Label htmlFor="search" className="whitespace-nowrap">Cerca:</Label>
              <Input
                id="search"
                placeholder="Nome, email, telefono, città..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <p>Caricamento...</p>
        ) : clienti?.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p>{searchTerm ? "Nessun cliente trovato con questa ricerca." : "Nessun cliente trovato. Crea il tuo primo cliente!"}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clienti?.map((cliente: Cliente) => (
              <Card key={cliente.id}>
                <CardHeader>
                  <CardTitle>{cliente.nome}</CardTitle>
                  <CardDescription>
                    {cliente.email || "Nessuna email"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {cliente.telefono && (
                    <p className="text-sm">Tel: {cliente.telefono}</p>
                  )}
                  {cliente.citta && (
                    <p className="text-sm">Città: {cliente.citta}</p>
                  )}
                  {cliente.nota && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{cliente.nota}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => handleViewDocumenti(cliente)}>
                      Documenti
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEdit(cliente)}>
                      Modifica
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(cliente.id)}>
                      Elimina
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Documenti Cliente Detail */}
      {selectedCliente && (
        <DocumentoDetail
          cliente={selectedCliente}
          documenti={documentiCliente || []}
          isLoading={loadingDocumenti}
          onClose={handleCloseDocumentoDetail}
          onDeleteDocumento={handleDeleteDocumento}
          onDownloadDocumento={handleDownloadDocumento}
        />
      )}
    </div>
  );
}

function DocumentoDetail({ cliente, documenti, isLoading, onClose, onDeleteDocumento, onDownloadDocumento }: {
  cliente: Cliente;
  documenti: Documento[];
  isLoading: boolean;
  onClose: () => void;
  onDeleteDocumento: (id: number, nomeFile: string) => void;
  onDownloadDocumento: (documento: Documento) => void;
}) {
  const categoriaLabel = (cat: string) => {
    const categories: Record<string, string> = {
      contratto: "Contratto",
      documento_identita: "Documento d'Identità",
      preventivo: "Preventivo",
      fattura: "Fattura",
      altro: "Altro",
    };
    return categories[cat] || cat;
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "-";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold">Documenti di {cliente.nome}</h2>
          <Button variant="outline" onClick={onClose}>Chiudi</Button>
        </div>

        {isLoading ? (
          <p>Caricamento documenti...</p>
        ) : documenti.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p>Nessun documento trovato per questo cliente.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {documenti.map((doc) => (
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
                      onClick={() => onDownloadDocumento(doc)}
                    >
                      Scarica
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => onDeleteDocumento(doc.id, doc.nome_file)}
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

function ClienteForm({ cliente, onClose }: { cliente: Cliente | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [citta, setCitta] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user?.id;

  useEffect(() => {
    if (cliente) {
      setNome(cliente.nome);
      setEmail(cliente.email);
      setTelefono(cliente.telefono);
      setCitta(cliente.citta);
      setNota(cliente.nota);
    } else {
      setNome("");
      setEmail("");
      setTelefono("");
      setCitta("");
      setNota("");
    }
  }, [cliente]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = cliente ? `/api/my/v1/clienti/${cliente.id}` : "/api/my/v1/clienti";
      const method = cliente ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clienti"] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || "Errore durante il salvataggio");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!nome.trim()) {
      setError("Il nome è richiesto");
      return;
    }

    mutation.mutate({
      user_id: userId,
      nome,
      email,
      telefono,
      citta,
      nota,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {cliente ? "Modifica Cliente" : "Nuovo Cliente"}
        </h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono">Telefono</Label>
            <Input
              id="telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+39 ..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="citta">Città</Label>
            <Input
              id="citta"
              value={citta}
              onChange={(e) => setCitta(e.target.value)}
              placeholder="Roma, Milano..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nota">Nota</Label>
            <Textarea
              id="nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Note sul cliente..."
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {cliente ? "Aggiorna" : "Crea"}
            </Button>
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
  const user = localStorage.getItem("user");
  const token = localStorage.getItem("token");
  
  if (user) {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token || ""}`,
    };
  }
  
  return { "Content-Type": "application/json" };
}
