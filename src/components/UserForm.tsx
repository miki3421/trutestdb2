import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface User {
  id: number;
  nome: string;
  cognome: string | null;
  email: string | null;
  telefono: string | null;
  indirizzo: string | null;
  piva: string | null;
  iva_esente: boolean;
}

interface UserFormProps {
  user: User | null;
  onClose: () => void;
}

export default function UserForm({ user, onClose }: UserFormProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [cognome, setCognome] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [indirizzo, setIndirizzo] = useState("");
  const [piva, setPiva] = useState("");
  const [iva_esente, setIvaEsente] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setNome(user.nome || "");
      setCognome(user.cognome || "");
      setEmail(user.email || "");
      setTelefono(user.telefono || "");
      setIndirizzo(user.indirizzo || "");
      setPiva(user.piva || "");
      setIvaEsente(user.iva_esente || false);
    } else {
      setNome("");
      setCognome("");
      setEmail("");
      setTelefono("");
      setIndirizzo("");
      setPiva("");
      setIvaEsente(false);
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/my/v1/users", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      });

      const result = await response.json();
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      localStorage.removeItem("user");
      const updatedUser = mutation.data?.user;
      if (updatedUser) {
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
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
      nome: nome.trim(),
      cognome: cognome.trim() || null,
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      indirizzo: indirizzo.trim() || null,
      piva: piva.trim() || null,
      iva_esente,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Il mio profilo</h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="cognome">Cognome</Label>
              <Input
                id="cognome"
                value={cognome}
                onChange={(e) => setCognome(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefono">Telefono</Label>
            <Input
              id="telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="indirizzo">Indirizzo</Label>
            <Textarea
              id="indirizzo"
              value={indirizzo}
              onChange={(e) => setIndirizzo(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="piva">Partita IVA</Label>
            <Input
              id="piva"
              value={piva}
              onChange={(e) => setPiva(e.target.value)}
              placeholder="Inserisci la tua P.IVA"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="iva_esente"
              checked={iva_esente}
              onCheckedChange={setIvaEsente}
            />
            <Label htmlFor="iva_esente">IVA Esente</Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              Salva
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
  const token = localStorage.getItem("token");
  
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token || ""}`,
  };
}
