import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import OrderForm from "../components/OrderForm";
import Navbar from "../components/Navbar";

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
  cliente_nome?: string;
  totale_pagato: number;
  stato_pagamento: "da_pagare" | "parzialmente_pagata" | "pagata";
  residuo: number;
  ultimo_pagamento: string | null;
}

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  // Filters
  const [clienteIdFilter, setClienteIdFilter] = useState("");
  const [statoPagamentoFilter, setStatoPagamentoFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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

  // Fetch payments for selected order
  const { data: pagamenti } = useQuery({
    queryKey: ["pagamenti", userId, selectedOrder?.id],
    queryFn: async () => {
      if (!selectedOrder) return [];
      const response = await fetch(`/api/my/v1/pagamenti?order_id=${selectedOrder.id}`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data.pagamenti;
    },
    enabled: !!selectedOrder && !!userId,
  });

  // Fetch orders with filters
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", userId, clienteIdFilter, statoPagamentoFilter, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (clienteIdFilter) params.append("cliente_id", clienteIdFilter);
      if (statoPagamentoFilter) params.append("stato_pagamento", statoPagamentoFilter);
      if (fromDate) params.append("from_date", fromDate);
      if (toDate) params.append("to_date", toDate);
      
      const response = await fetch(`/api/my/v1/orders?${params.toString()}`, {
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

  const paymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const response = await fetch(`/api/my/v1/pagamenti`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(paymentData),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["pagamenti"] });
      setShowPaymentModal(false);
      setSelectedOrder(null);
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

  const handlePayment = (order: Order) => {
    setSelectedOrder(order);
    setShowPaymentModal(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingOrder(null);
  };

  const handleClearFilters = () => {
    setClienteIdFilter("");
    setStatoPagamentoFilter("");
    setFromDate("");
    setToDate("");
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

  const statoPagamentoLabel = (stato: string) => {
    switch (stato) {
      case "da_pagare": return "Da pagare";
      case "parzialmente_pagata": return "Parzialmente pagata";
      case "pagata": return "Pagata";
      default: return stato;
    }
  };

  const statoPagamentoColor = (stato: string) => {
    switch (stato) {
      case "da_pagare": return "bg-red-100 text-red-800 border-red-200";
      case "parzialmente_pagata": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "pagata": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h1 className="text-3xl font-bold">Ordini / Fatture</h1>
          <Button onClick={() => setShowForm(true)}>
            Nuovo Ordine
          </Button>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
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
                <Label htmlFor="stato_pagamento_filter">Stato Pagamento</Label>
                <select 
                  value={statoPagamentoFilter} 
                  onChange={(e) => setStatoPagamentoFilter(e.target.value)} 
                  className="w-full p-2 border rounded"
                >
                  <option value="">Tutti</option>
                  <option value="da_pagare">Da pagare</option>
                  <option value="parzialmente_pagata">Parzialmente pagata</option>
                  <option value="pagata">Pagata</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="from_date">Dal</Label>
                <Input
                  id="from_date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="to_date">Al</Label>
                <Input
                  id="to_date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>

            {(clienteIdFilter || statoPagamentoFilter || fromDate || toDate) && (
              <div className="mt-4">
                <Button variant="outline" size="sm" onClick={handleClearFilters}>
                  Pulisci filtri
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {showForm && (
          <OrderForm
            order={editingOrder}
            onClose={handleCloseForm}
          />
        )}

        {showPaymentModal && selectedOrder && (
          <PaymentModal
            order={selectedOrder}
            pagamenti={pagamenti || []}
            onSubmit={(data) => paymentMutation.mutate(data)}
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedOrder(null);
            }}
          />
        )}

        {isLoading ? (
          <p>Caricamento...</p>
        ) : orders?.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p>Nessun ordine trovato.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orders?.map((order: Order) => (
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
                    <>
                      <p className="text-lg font-semibold">€ {order.totale.toFixed(2)}</p>
                      <div className={`px-2 py-1 rounded text-xs font-medium border ${statoPagamentoColor(order.stato_pagamento)}`}>
                        {statoPagamentoLabel(order.stato_pagamento)}
                      </div>
                      {order.residuo > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Da pagare: € {order.residuo.toFixed(2)}
                        </p>
                      )}
                    </>
                  )}
                  <div className="flex gap-2 pt-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(order)}>
                      Modifica
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(order.id)}>
                      Elimina
                    </Button>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      onClick={async () => {
                        const token = localStorage.getItem("token");
                        try {
                          const response = await fetch(`/api/my/v1/fattura/${order.id}`, {
                            headers: getAuthHeaders(),
                          });
                          const data = await response.json();
                          if (!data.ok || !data.html) {
                            throw new Error(data.error || "Impossibile generare la fattura");
                          }
                          const newWindow = window.open("", "_blank");
                          if (newWindow) {
                            newWindow.document.write(data.html);
                            newWindow.document.close();
                          }
                        } catch (err: any) {
                          alert(err.message || "Errore nella generazione della fattura");
                        }
                      }}
                    >
                      Fattura
                    </Button>
                    {order.residuo > 0 && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handlePayment(order)}
                      >
                        Pagamento
                      </Button>
                    )}
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

function PaymentModal({ order, pagamenti, onSubmit, onClose }: { 
  order: Order; 
  pagamenti: any[];
  onSubmit: (data: any) => void;
  onClose: () => void;
}) {
  const [importo, setImporto] = useState("");
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split("T")[0]);
  const [metodo, setMetodo] = useState("bonifico");
  const [nota, setNota] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Registra Pagamento</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Fattura #{order.id} - Da pagare: € {order.residuo.toFixed(2)}
        </p>

        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            order_id: order.id,
            importo: parseFloat(importo),
            data_pagamento: dataPagamento,
            metodo: metodo,
            nota: nota,
          });
        }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="importo">Importo *</Label>
            <Input
              id="importo"
              type="number"
              step="0.01"
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              placeholder={`Max € ${order.residuo.toFixed(2)}`}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_pagamento">Data Pagamento *</Label>
            <Input
              id="data_pagamento"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="metodo">Metodo di Pagamento *</Label>
            <select 
              value={metodo} 
              onChange={(e) => setMetodo(e.target.value)} 
              className="w-full p-2 border rounded"
            >
              <option value="bonifico">Bonifico Bancario</option>
              <option value="contanti">Contanti</option>
              <option value="carta">Carta di Credito/Debito</option>
              <option value="paypal">PayPal</option>
              <option value="altro">Altro</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nota">Nota</Label>
            <Textarea
              id="nota"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Note sul pagamento..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Pagamenti precedenti</Label>
            {pagamenti.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun pagamento registrato</p>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {pagamenti.map((p) => (
                  <div key={p.id} className="flex justify-between text-sm border-b pb-1">
                    <span>{p.data_pagamento}</span>
                    <span className="font-medium">€ {p.importo.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">Registra</Button>
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
