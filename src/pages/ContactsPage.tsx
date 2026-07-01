import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ContactForm from "../components/ContactForm";
import Navbar from "../components/Navbar";

interface Contact {
  id: number;
  user_id: number;
  nome: string;
  email: string | null;
  telefono: string | null;
  nota: string | null;
  created_at: string | null;
}

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user?.id;

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts", userId],
    queryFn: async () => {
      const response = await fetch(`/api/my/v1/contacts?user_id=${userId}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data.contacts;
    },
    enabled: !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/my/v1/contacts/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setShowForm(false);
      setEditingContact(null);
    },
  });

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Sei sicuro di voler eliminare questo contatto?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingContact(null);
  };

  if (!userId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p>Devi essere autenticato per visualizzare i contatti.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Contatti</h1>
          <Button onClick={() => setShowForm(true)}>
            Nuovo Contatto
          </Button>
        </div>

        {showForm && (
          <ContactForm
            contact={editingContact}
            onClose={handleCloseForm}
          />
        )}

        {isLoading ? (
          <p>Caricamento...</p>
        ) : contacts?.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p>Nessun contatto trovato. Aggiungi il tuo primo contatto!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {contacts?.map((contact) => (
              <Card key={contact.id}>
                <CardHeader>
                  <CardTitle>{contact.nome}</CardTitle>
                  <CardDescription>
                    {contact.email || "Nessuna email"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {contact.telefono && (
                    <p className="text-sm text-gray-600">Telefono: {contact.telefono}</p>
                  )}
                  {contact.nota && (
                    <p className="text-sm text-gray-600 line-clamp-2">{contact.nota}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(contact)}>
                      Modifica
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(contact.id)}>
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

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem("token");
  
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token || ""}`,
  };
}
