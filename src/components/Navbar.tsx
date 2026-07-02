import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-bold text-lg">
            TruTestDB
          </Link>
          {user?.id && (
            <>
              <Link to="/dashboard" className="text-sm hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link to="/contacts" className="text-sm hover:text-primary transition-colors">
                Contatti
              </Link>
              <Link to="/clienti" className="text-sm hover:text-primary transition-colors">
                Clienti
              </Link>
              <Link to="/orders" className="text-sm hover:text-primary transition-colors">
                Ordini
              </Link>
              <Link to="/scadenze" className="text-sm hover:text-primary transition-colors">
                Scadenze
              </Link>
              <Link to="/profile" className="text-sm hover:text-primary transition-colors">
                Profilo
              </Link>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          {user?.nome ? (
            <>
              <span className="text-sm text-muted-foreground">
                Ciao, {user.nome}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Accedi
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Registrati</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
