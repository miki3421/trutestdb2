import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (token) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p>Caricamento...</p>
    </div>
  );
};

export default Index;
