import axios from "axios";
import React, { useEffect, useState } from "react";
import PhoneInput from "react-phone-number-input";
import "react-phone-number-input/style.css";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

export default function ProfileTab({ token, closeTab }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [monthlyTarget, setMonthlyTarget] = useState(0);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get(`${API_URL}/info`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((response) => {
        setError("");
        setEmail(response.data.email);
        setUserName(response.data.user_name);
        setMonthlyTarget(Number(response.data.monthly_target));
        setPassword("••••••••••••");
        setPhone(response.data.phone_number ? response.data.phone_number : "");
      })
      .catch((error) => {
        console.log(error);
      });
  }, []);

  return (
    <div className="sheet-actions">
      <div className="field">
        <label>Full Name</label>
        <input
          type="text"
          placeholder="Alex"
          value={userName}
          onChange={(e) => {
            setUserName(e.target.value);
          }}
        />
      </div>
      <div className="field">
        <label>Email</label>
        <input
          type="email"
          placeholder="e.g. alex.dev@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
      </div>
      <div className="field">
        <label>Password</label>
        <input type="password" value={password} readOnly />
      </div>

      <div className="field">
        <label>Phone Number (optional)</label>
        <PhoneInput
          placeholder="Enter phone number"
          value={phone}
          onChange={setPhone}
          defaultCountry="US" /* Defaults to USA flag, change to your preference */
          international
        />
      </div>

      <div className="field">
        <label>Monthly Budget</label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={monthlyTarget}
          onChange={(e) => {
            setMonthlyTarget(e.target.value ? Math.abs(e.target.value) : "");
          }}
        />
      </div>
      {error && (
        <div
          style={{
            color: "var(--coral)",
            fontSize: "14px",
            marginBottom: "10px",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      <div className="field">
        <button
          className="btn btn-primary"
          style={{ marginTop: "8px" }}
          onClick={async () => {
            try {
              if (!email || !userName || !monthlyTarget) {
                setError("Please fill in all fields.");
                return;
              }
              setError("");
              await axios.put(
                `${API_URL}/profile`,
                {
                  email: email,
                  user_name: userName,
                  monthly_target: monthlyTarget,
                  phone_number: phone,
                },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                },
              );
              closeTab();
            } catch (err) {
              setError(err.response?.data?.error || "Failed to save profile.");
            }
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
