import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    gender: "",
    age: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleRegister = async () => {
    if (!agreed) return alert("개인정보 수집 및 이용에 동의해주세요!");
    try {
      const res = await axios.post("/api/users/register", {
        ...form,
        age: parseInt(form.age),
      });
      alert(res.data);
      navigate("/login");
    } catch (e) {
      alert("회원가입 실패");
    }
  };

  const inputStyle = {
    width: "100%",
    maxWidth: "300px",
    padding: "14px",
    marginBottom: "12px",
    borderRadius: "10px",
    border: "1.5px solid #20C4F4",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
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
      <p style={{ color: "#20C4F4", fontSize: "13px", marginBottom: "40px" }}>회원가입</p>

      <input placeholder="이름" name="name" value={form.name} onChange={handleChange} style={inputStyle} />
      <input placeholder="이메일" name="email" value={form.email} onChange={handleChange} style={inputStyle} />

      <div style={{
        width: "100%",
        maxWidth: "300px",
        marginBottom: "12px",
        display: "flex",
        gap: "10px",
      }}>
        <button
          onClick={() => setForm({ ...form, gender: "m" })}
          style={{
            flex: 1, padding: "14px", borderRadius: "10px",
            border: form.gender === "m" ? "2px solid #0083CA" : "1.5px solid #20C4F4",
            backgroundColor: form.gender === "m" ? "#E8F4FD" : "white",
            fontWeight: form.gender === "m" ? "bold" : "normal",
            color: form.gender === "m" ? "#0083CA" : "#888",
            cursor: "pointer",
          }}
        >남성</button>
        <button
          onClick={() => setForm({ ...form, gender: "f" })}
          style={{
            flex: 1, padding: "14px", borderRadius: "10px",
            border: form.gender === "f" ? "2px solid #0083CA" : "1.5px solid #20C4F4",
            backgroundColor: form.gender === "f" ? "#E8F4FD" : "white",
            fontWeight: form.gender === "f" ? "bold" : "normal",
            color: form.gender === "f" ? "#0083CA" : "#888",
            cursor: "pointer",
          }}
        >여성</button>
      </div>

      <input placeholder="나이" name="age" value={form.age} onChange={handleChange} style={{ ...inputStyle, marginBottom: "20px" }} />

      {/* 개인정보 동의 */}
      <div style={{
        width: "100%",
        maxWidth: "300px",
        marginBottom: "24px",
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={() => setAgreed(!agreed)}
          style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#0083CA" }}
        />
        <span style={{ fontSize: "13px", color: "#555" }}>
          <span
            onClick={() => setShowModal(true)}
            style={{ color: "#0083CA", textDecoration: "underline", cursor: "pointer" }}
          >개인정보 수집 및 이용</span>에 동의합니다
        </span>
      </div>

      <button
        onClick={handleRegister}
        style={{
          width: "100%", maxWidth: "300px", padding: "14px",
          backgroundColor: "#0083CA", color: "white",
          border: "none", borderRadius: "10px",
          fontSize: "16px", fontWeight: "bold", cursor: "pointer",
        }}
      >회원가입</button>

      {/* 약관 모달 */}
      {showModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "16px",
            padding: "24px",
            width: "90%",
            maxWidth: "340px",
            maxHeight: "70vh",
            overflowY: "auto",
          }}>
            <h3 style={{ color: "#0083CA", fontWeight: "bold", marginBottom: "16px" }}>개인정보 수집 및 이용 동의</h3>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: "1.8" }}>
              <strong>1. 수집하는 개인정보 항목</strong><br />
              이름, 이메일, 성별, 나이, 금융거래 내역<br /><br />
              <strong>2. 개인정보 수집 및 이용 목적</strong><br />
              소비 패턴 분석 및 맞춤형 소비 일기 생성, 금융 상품 추천 서비스 제공<br /><br />
              <strong>3. 개인정보 보유 및 이용 기간</strong><br />
              서비스 이용 기간 동안 보유하며, 탈퇴 시 즉시 파기<br /><br />
              <strong>4. 마이데이터 연동 동의</strong><br />
              Codef API를 통해 은행 및 카드사의 거래 내역을 수집합니다. 수집된 데이터는 소비 분석 목적으로만 사용됩니다.<br /><br />
              <strong>5. 동의 거부 권리</strong><br />
              개인정보 수집에 동의하지 않을 권리가 있으나, 동의 거부 시 서비스 이용이 제한됩니다.
            </p>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1, padding: "12px", borderRadius: "10px",
                  border: "1.5px solid #ddd", backgroundColor: "white",
                  color: "#555", cursor: "pointer", fontWeight: "bold",
                }}
              >닫기</button>
              <button
                onClick={() => { setAgreed(true); setShowModal(false); }}
                style={{
                  flex: 1, padding: "12px", borderRadius: "10px",
                  border: "none", backgroundColor: "#0083CA",
                  color: "white", cursor: "pointer", fontWeight: "bold",
                }}
              >동의하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Register;