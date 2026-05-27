import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");

  const handleLogin = async () => {
    try {
      const res = await axios.post("/api/users/login", { email });
      const token = res.data.token;
      localStorage.setItem("token", token);
      try {
        const decoded = jwtDecode(token);
        if (decoded.sub) localStorage.setItem("user_id", decoded.sub);
      } catch {}
      navigate("/home");
    } catch (e) {
      alert("로그인 실패");
    }
  };
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      padding: "20px",
      backgroundColor: "white",
    }}>
      <h1 style={{
        fontSize: "36px",
        fontWeight: "bold",
        marginBottom: "8px",
        color: "#0083CA",
        letterSpacing: "3px",
      }}>So-Bee</h1>
      <p style={{ color: "#20C4F4", fontSize: "13px", marginBottom: "48px" }}>스마트 소비 일기</p>

      <input
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{
          width: "100%", maxWidth: "300px", padding: "14px",
          marginBottom: "12px", borderRadius: "10px",
          border: "1.5px solid #20C4F4", fontSize: "14px",
          outline: "none", boxSizing: "border-box",
        }}
      />
      <button
        onClick={handleLogin}
        style={{
          width: "100%", maxWidth: "300px", padding: "14px",
          backgroundColor: "#0083CA", color: "white",
          border: "none", borderRadius: "10px",
          fontSize: "16px", fontWeight: "bold", cursor: "pointer",
          marginBottom: "12px",
        }}
      >로그인</button>
      <button
        onClick={() => navigate("/register")}
        style={{
          width: "100%", maxWidth: "300px", padding: "14px",
          backgroundColor: "white", color: "#0083CA",
          border: "1.5px solid #0083CA", borderRadius: "10px",
          fontSize: "16px", fontWeight: "bold", cursor: "pointer",
        }}
      >회원가입</button>
    </div>
  );
}

export default Login;