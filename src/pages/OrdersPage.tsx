import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import OrderForm from "../components/OrderForm";
import Navbar from "../components/Navbar";

interface Contact {
  id: number;
  nome: string;
}

interface Order {
  id: number;
  user_id: number;
  contatto_id: number | null;
  cliente_id: number | null;
  data_ordine: string | null;
  stato: string;
  totale: number | null;
  created_at: string | null;
  cliente_nome?: string;
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user?.id;

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", userId],
    queryFn: async () => {
      const response = await fetch(`/api/my/v1/orders?user_id=${userId}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data.orders;
    },
    enabled: !!userId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/my/v1/orders/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setShowForm(false);
      setEditingOrder(null);
    },
  });

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Sei sicuro di voler eliminare questo ordine?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingOrder(null);
  };

  if (!userId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="pt-6">
            <p>Devi essere autenticato per visualizzare gli ordini.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statoColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    shipped: "bg-blue-100 text-blue-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Ordini</h1>
          <Button onClick={() => setShowForm(true)}>
            Nuovo Ordine
          </Button>
        </div>

        {showForm && (
          <OrderForm
            order={editingOrder}
            onClose={handleCloseForm}
          />
        )}

        {isLoading ? (
          <p>Caricamento...</p>
        ) : orders?.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p>Nessun ordine trovato. Crea il tuo primo ordine!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orders?.map((order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>Ordine #{order.id}</CardTitle>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statoColor[order.stato] || "bg-gray-100"}`}>
                      {order.stato}
                    </span>
                  </div>
                  <CardDescription>
                    {order.data_ordine ? new Date(order.data_ordine).toLocaleDateString("it-IT") : "Data non specificata"}
                    {order.cliente_nome && (
                      <div className="mt-1 text-sm font-medium">{order.cliente_nome}</div>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {order.totale !== null && (
                    <p className="text-lg font-semibold">€ {order.totale.toFixed(2)}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(order)}>
                      Modifica
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(order.id)}>
                      Elimina
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => {
                      const token = localStorage.getItem("token");
                      window.open(`/api/my/v1/fattura/${order.id}?token=${token}`, "_blank");
                    }}>
                      Fattura
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
