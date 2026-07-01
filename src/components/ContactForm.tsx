import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Contact {
  id: number;
  user_id: number;
  nome: string;
  email: string | null;
  telefono: string | null;
  nota: string | null;
  created_at: string | null;
}

interface ContactFormProps {
  contact: Contact | null;
  onClose: () => void;
}

export default function ContactForm({ contact, onClose }: ContactFormProps) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (contact) {
      setNome(contact.nome);
      setEmail(contact.email || "");
      setTelefono(contact.telefono || "");
      setNota(contact.nota || "");
    } else {
      setNome("");
      setEmail("");
      setTelefono("");
      setNota("");
    }
  }, [contact]);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user?.id;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = contact
        ? `/api/my/v1/contacts/${contact.id}`
        : "/api/my/v1/contacts";
      const method = contact ? "PUT" : "POST";

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
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
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
      nome: nome.trim(),
      email: email.trim() || null,
      telefono: telefono.trim() || null,
      nota: nota.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">
          {contact ? "Modifica Contatto" : "Nuovo Contatto"}
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
            <Label htmlFor="nota">Nota</Label>
            <Textarea
              id="nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {contact ? "Aggiorna" : "Crea"}
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
    const userData = JSON.parse(user);
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token || ""}`,
      "user_id": String(userData?.id || ""),
    };
  }
  
  return { "Content-Type": "application/json" };
}
