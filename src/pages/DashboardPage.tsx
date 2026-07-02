import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "../components/Navbar";

interface LastPayment {
  id: number;
  order_id: number;
  importo: number;
  data_pagamento: string | null;
  metodo: string;
  nota: string | null;
  cliente_nome: string;
}

interface DashboardData {
  totale_fatture: number;
  totale_emesse: number;
  totale_incassato: number;
  totale_da_incassare: number;
  scadute_count: number;
  ultimi_pagamenti: LastPayment[];
}

export default function DashboardPage() {
  const token = localStorage.getItem("token");

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const response = await fetch("/api/my/v1/dashboard", {
        headers: getAuthHeaders(),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error);
      return data.dashboard as DashboardData;
    },
    enabled: !!token,
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="pt-6">
              <p>Devi essere autenticato per visualizzare la dashboard.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto py-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <div className="flex gap-2">
            <Link to="/clienti">
              <Button variant="outline">Clienti</Button>
            </Link>
            <Link to="/orders">
              <Button>Ordini</Button>
            </Link>
            <Link to="/scadenze">
              <Button variant="secondary">Scadenze</Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Fatture Emesse</CardDescription>
              <CardTitle className="text-4xl">{isLoading ? "-" : dashboard?.totale_fatture || 0}</CardTitle>
            </CardHeader>
            <CardContent>
              <Link to="/orders" className="text-sm text-primary hover:underline">
                Vedi tutte →
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Totale Emissione</CardDescription>
              <CardTitle className="text-4xl">
                {isLoading ? "-" : `€ ${(dashboard?.totale_emesse || 0).toFixed(2)}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Fatturato totale</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Totale Incassato</CardDescription>
              <CardTitle className="text-4xl">
                {isLoading ? "-" : `€ ${(dashboard?.totale_incassato || 0).toFixed(2)}`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-green-600 font-medium">Da pagare: € {(dashboard?.totale_da_incassare || 0).toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Fatture Scadute</CardDescription>
              <CardTitle className={`text-4xl ${dashboard?.scadute_count ? "text-red-600" : ""}`}>
                {isLoading ? "-" : dashboard?.scadute_count || 0}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Link to="/scadenze" className="text-sm text-primary hover:underline">
                Vedi scadenze →
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Scadenze Alert */}
        {dashboard?.scadute_count && dashboard.scadute_count > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-800">⚠️ Hai {dashboard.scadute_count} fattura{dashboard.scadute_count > 1 ? "e" : ""} scaduta{dashboard.scadute_count > 1 ? "e" : ""}</CardTitle>
              <CardDescription className="text-red-700">
                Controlla la pagina Scadenze per gestire i pagamenti in ritardo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/scadenze">
                <Button variant="destructive">Vai alle Scadenze</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Ultimi Pagamenti */}
        <Card>
          <CardHeader>
            <CardTitle>Ultimi Pagamenti Ricevuti</CardTitle>
            <CardDescription>I 5 pagamenti più recenti</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p>Caricamento...</p>
            ) : !dashboard?.ultimi_pagamenti || dashboard.ultimi_pagamenti.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Nessun pagamento registrato</p>
                <Link to="/orders">
                  <Button>Gestisci Ordini</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {dashboard.ultimi_pagamenti.map((pagamento: LastPayment) => (
                  <div
                    key={pagamento.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-semibold">
                        €
                      </div>
                      <div>
                        <p className="font-medium">{pagamento.cliente_nome || `Fattura #${pagamento.order_id}`}</p>
                        <p className="text-sm text-muted-foreground">
                          {pagamento.data_pagamento 
                            ? new Date(pagamento.data_pagamento).toLocaleDateString("it-IT")
                            : "Data non specificata"}
                          {pagamento.metodo && ` • ${pagamento.metodo}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Pagato
                      </span>
                      <p className="font-semibold text-green-700">
                        € {pagamento.importo.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Azioni Rapide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <Link to="/clienti">
                <Button variant="outline">
                  + Nuovo Cliente
                </Button>
              </Link>
              <Link to="/orders">
                <Button>
                  + Nuova Fattura
                </Button>
              </Link>
              <Link to="/scadenze">
                <Button variant="secondary">
                  Vedi Scadenze
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
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
