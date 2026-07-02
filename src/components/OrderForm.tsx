import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Cliente {
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
}

interface OrderFormProps {
  order: Order | null;
  onClose: () => void;
}

export default function OrderForm({ order, onClose }: OrderFormProps) {
  const queryClient = useQueryClient();

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const userId = user?.id;

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

  const [cliente_id, setClienteId] = useState<string>("");
  const [contatto_id, setContattoId] = useState<string>("");
  const [data_ordine, setDataOrdine] = useState("");
  const [stato, setStato] = useState("pending");
  const [totale, setTotale] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (order) {
      setClienteId(order.cliente_id ? String(order.cliente_id) : "");
      setContattoId(order.contatto_id ? String(order.contatto_id) : "");
      setDataOrdine(order.data_ordine || new Date().toISOString().split("T")[0]);
      setStato(order.stato);
      setTotale(order.totale !== null ? String(order.totale) : "");
    } else {
      setContattoId("");
      setDataOrdine(new Date().toISOString().split("T")[0]);
      setStato("pending");
      setTotale("");
    }
  }, [order]);

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = order ? `/api/my/v1/orders/${order.id}` : "/api/my/v1/orders";
      const method = order ? "PUT" : "POST";

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
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || "Errore durante il salvataggio");
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!data_ordine) {
      setError("La data ordine è richiesta");
      return;
    }

    mutation.mutate({
      user_id: userId,
      cliente_id: cliente_id ? parseInt(cliente_id) : null,
      contatto_id: contatto_id ? parseInt(contatto_id) : null,
      data_ordine,
      stato,
      totale: totale ? parseFloat(totale) : null,
    });
  };

  const stati = ["pending", "shipped", "delivered", "cancelled"];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-2xl font-bold mb-4">
          {order ? "Modifica Ordine" : "Nuovo Ordine"}
        </h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cliente">Cliente</Label>
            <select
              id="cliente"
              value={cliente_id}
              onChange={(e) => setClienteId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">Nessun cliente</option>
              {clienti?.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_ordine">Data Ordine *</Label>
            <Input
              id="data_ordine"
              type="date"
              value={data_ordine}
              onChange={(e) => setDataOrdine(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="stato">Stato</Label>
            <select
              id="stato"
              value={stato}
              onChange={(e) => setStato(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="pending">In attesa</option>
              <option value="shipped">Spedito</option>
              <option value="delivered">Consegnato</option>
              <option value="cancelled">Annullato</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="totale">Totale (€)</Label>
            <Input
              id="totale"
              type="number"
              step="0.01"
              min="0"
              value={totale}
              onChange={(e) => setTotale(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              {order ? "Aggiorna" : "Crea"}
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
