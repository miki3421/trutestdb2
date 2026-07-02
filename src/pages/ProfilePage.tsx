import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import UserForm from "../components/UserForm";
import Navbar from "../components/Navbar";

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

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user?.id;

  const { data: userData, isLoading } = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      const response = await fetch(`/api/my/v1/users?user_id=${userId}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data.user;
    },
    enabled: !!userId,
  });

  const handleEdit = () => {
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
  };

  if (!userId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p>Devi essere autenticato per visualizzare il profilo.</p>
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
          <h1 className="text-3xl font-bold">Il mio profilo</h1>
          <Button onClick={handleEdit}>
            Modifica
          </Button>
        </div>

        {showForm && (
          <UserForm
            user={userData}
            onClose={handleCloseForm}
          />
        )}

        {isLoading ? (
          <p>Caricamento...</p>
        ) : userData ? (
          <Card>
            <CardHeader>
              <CardTitle>{userData.nome} {userData.cognome}</CardTitle>
              <CardDescription>Dati personali e aziendali</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Nome</p>
                  <p>{userData.nome}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Cognome</p>
                  <p>{userData.cognome || "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p>{userData.email || "-"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Telefono</p>
                  <p>{userData.telefono || "-"}</p>
                </div>
              </div>

              {userData.indirizzo && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Indirizzo</p>
                  <p>{userData.indirizzo}</p>
                </div>
              )}

              {userData.piva && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Partita IVA</p>
                  <p>{userData.piva}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-gray-500">IVA Esente</p>
                <p>{userData.iva_esente ? "Sì" : "No"}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p>Nessun dato utente trovato.</p>
            </CardContent>
          </Card>
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
