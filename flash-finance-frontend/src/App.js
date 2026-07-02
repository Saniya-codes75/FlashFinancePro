import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import Login from './Login'; 
import './App.css';
import ReceiptScanner from './ReceiptScanner';
import GamificationPanel from './GamificationPanel';

function App() {
  const [userInput, setUserInput] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [totals, setTotals] = useState({ total_spent: 0, breakdown: {} });
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [isListening, setIsListening] = useState(false);
  
  // State for tracking smart financial coaching insights
  const [advice, setAdvice] = useState("Loading financial strategy...");
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  // Authentication status states
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
  const [currentUsername, setCurrentUsername] = useState(localStorage.getItem('username') || "");

  // Budget Tracking State Additions
  const [budgetLimit, setBudgetLimit] = useState(0);
  const [newBudgetInput, setNewBudgetInput] = useState("");
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  const getAuthConfig = () => {
    const token = localStorage.getItem('token');
    return {
      headers: {
        Authorization: `Bearer ${token}`
      }
    };
  };

  // Fetches personalized insight rules from Django
  const fetchAdvisorAdvice = async () => {
    setLoadingAdvice(true);
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/expenses/advisor/', getAuthConfig());
      if (response.data.status === 'success') {
        setAdvice(response.data.advice);
      }
    } catch (error) {
      console.error("Error fetching financial advisory tips:", error);
      setAdvice("Could not generate active insights. Try refreshing the panel.");
    } finally {
      setLoadingAdvice(false);
    }
  };

  const fetchSummaryData = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/expenses/summary/', getAuthConfig());
      if (response.data.status === 'success') {
        setTotals({
          total_spent: response.data.total_spent,
          breakdown: response.data.breakdown
        });
        setBudgetLimit(response.data.budget_limit || 0); // Synchronize budget metrics state
        setRecentExpenses(response.data.recent_expenses);
      }
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      if (error.response?.status === 403 || error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  // Handles bulk cleaning all expense data records
  const handleClearAllExpenses = async () => {
    // Falls back to current system year-month if custom dynamic timeframe partitions aren't defined
    const activeTimeframe = new Date().toISOString().slice(0, 7);
    const confirmWipe = window.confirm(`Are you sure you want to clear all transactions? This resets analytics to ₹0.`);
    if (!confirmWipe) return;

    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/api/expenses/bulk_delete_expenses/',
        { target_month: activeTimeframe },
        getAuthConfig()
      );

      if (response.data && response.data.status === 'success') {
        alert(response.data.message);
        fetchSummaryData(); // Instantly update totals layout to ₹0
        fetchAdvisorAdvice(); // Update coach advisory block
      }
    } catch (error) {
      console.error("Wipe failed:", error);
      alert("Failed to delete expenses. Verify your backend model configurations.");
    }
  };

  // Triggered automatically on login state sync
  useEffect(() => {
    if (isLoggedIn) {
      fetchSummaryData();
      fetchAdvisorAdvice(); 
    }
  }, [isLoggedIn]);

  // Speech Recognition Engine Configuration
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Voice control is not supported by your current browser profile. Switch to Google Chrome!");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN'; 
    recognition.interimResults = false; 
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const voiceText = event.results[0][0].transcript;
      console.log("Speech-To-Text Transcription Log:", voiceText);
      setUserInput(voiceText); 
    };

    recognition.onerror = (err) => {
      console.error("Speech structural processing error:", err);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const handleAnalyze = async () => {
    if (!userInput.trim()) return;
    try {
      const response = await axios.post('http://127.0.0.1:8000/api/expenses/add-ai/', {
        text: userInput
      }, getAuthConfig());
      
      setAiResult(response.data.data);
      fetchSummaryData();
      fetchAdvisorAdvice(); 
      setUserInput(""); 
    } catch (error) {
      console.error("Error connecting to Django:", error);
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await axios.delete(`http://127.0.0.1:8000/api/expenses/delete/${id}/`, getAuthConfig());
      if (response.data.status === 'success') {
        fetchSummaryData();
        fetchAdvisorAdvice(); 
      }
    } catch (error) {
      console.error("Failed deleting row item:", error);
    }
  };

  // Updates the user's budget threshold configurations via API
  const handleUpdateBudget = async () => {
    if (!newBudgetInput || isNaN(newBudgetInput)) return;
    try {
      const config = {
        headers: {
          ...getAuthConfig().headers,
          'Content-Type': 'application/json'
        }
      };

      const response = await axios.post(
        'http://127.0.0.1:8000/api/expenses/update-budget/', 
        { budget_limit: parseFloat(newBudgetInput) }, 
        config
      );

      if (response.data.status === 'success') {
        setBudgetLimit(parseFloat(newBudgetInput));
        setIsEditingBudget(false);
        fetchSummaryData(); // Refresh the analytics card automatically
      }
    } catch (error) {
      console.error("Error updating budget metrics limit settings:", error.response?.data || error);
      alert("Failed to update budget. Check console for error details.");
    }
  };

  // Fixed CSV Download Function with Binary UTF-8 BOM injection
  const downloadCSV = () => {
    if (recentExpenses.length === 0) {
      alert("No transaction records available to export!");
      return;
    }

    const headers = ["Transaction ID", "Title", "Category", "Amount (₹)"];
    
    const rows = recentExpenses.map(item => [
      item.id,
      `"${item.title.replace(/"/g, '""')}"`, 
      item.category,
      item.amount
    ]);

    const csvContent = [
      headers.join(","), 
      ...rows.map(e => e.join(","))
    ].join("\n");

    const encoder = new TextEncoder();
    const csvBytes = encoder.encode(csvContent);
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    
    const totalBytes = new Uint8Array(bom.length + csvBytes.length);
    totalBytes.set(bom, 0);
    totalBytes.set(csvBytes, bom.length);

    const blob = new Blob([totalBytes], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FlashFinance_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    setIsLoggedIn(false);
    setCurrentUsername("");
    setTotals({ total_spent: 0, breakdown: {} });
    setRecentExpenses([]);
    setAiResult(null);
    setAdvice("");
  };

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setCurrentUsername(localStorage.getItem('username') || "");
  };

  if (!isLoggedIn) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const chartData = Object.entries(totals.breakdown).map(([category, amount]) => ({
    name: category,
    value: amount
  })).filter(item => item.value > 0);

  const COLORS = ['#00f2fe', '#4facfe', '#b5179e', '#7209b7', '#f72585', '#4cc9f0'];
  const usagePercentage = budgetLimit > 0 ? (totals.total_spent / budgetLimit) * 100 : 0;

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: 'rgba(255,255,255,0.02)', padding: '15px 30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Hello, <span style={{ color: '#00f2fe' }}>{currentUsername}</span> 👋</h2>
          <span style={{ fontSize: '12px', opacity: 0.5 }}>Personalized Expense Workspace</span>
        </div>
        <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}>
          Log Out
        </button>
      </div>

      {/* Main App Workspace */}
      <div className="App" style={{ display: 'flex', gap: '25px', justifyContent: 'center', alignItems: 'flex-start', marginBottom: '30px', flexWrap: 'wrap' }}>
        
        {/* LEFT COLUMN: AI Inputs Sequence */}
        <div style={{ flex: '1 1 400px', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
          {/* Original Input Card */}
          <div className="glass-card" style={{ width: '100%', boxSizing: 'border-box' }}>
            <h1>FlashFinance Pro</h1>
            <p>AI-Powered Expense Tracker</p>
            
            <div style={{ position: 'relative', width: '100%' }}>
              <input 
                type="text" 
                placeholder="e.g., Spent 500 on pizza" 
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                style={{ width: '100%', paddingRight: '45px', boxSizing: 'border-box' }}
              />
              
              <button 
                onClick={handleVoiceInput}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  color: isListening ? '#f72585' : '#00f2fe',
                  animation: isListening ? 'pulse 1.5s infinite' : 'none',
                  padding: '5px'
                }}
                title="Speak your transaction"
              >
                {isListening ? "🛑" : "🎙️"}
              </button>
            </div>
            
            <button className="btn" onClick={handleAnalyze} style={{ width: '100%', marginTop: '10px' }}>
              Analyze with AI
            </button>

            {aiResult && (
              <div className="result-area" style={{ textAlign: 'left' }}>
                <h3>AI Analysis:</h3>
                <p><strong>Title:</strong> {aiResult.title}</p>
                <p><strong>Amount:</strong> ₹{aiResult.amount}</p>
                <p><strong>Category:</strong> {aiResult.category}</p>
              </div>
            )}
          </div>

          {/* Image Receipt Scanner Card */}
          <div className="glass-card" style={{ width: '100%', padding: '5px', boxSizing: 'border-box' }}>
            <ReceiptScanner />
          </div>

        </div>

        {/* CARD 2: Dashboard Analytics */}
        <div className="glass-card" style={{ flex: '1 1 350px', maxWidth: '380px', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ marginTop: 0, marginBottom: 0 }}>Analytics</h2>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {!isEditingBudget ? (
                <span 
                  onClick={() => { setIsEditingBudget(true); setNewBudgetInput(budgetLimit); }}
                  style={{ fontSize: '12px', color: '#00f2fe', cursor: 'pointer', opacity: 0.8 }}
                >
                  ⚙️ Set Limit
                </span>
              ) : (
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input 
                    type="number" 
                    value={newBudgetInput} 
                    onChange={(e) => setNewBudgetInput(e.target.value)}
                    style={{ width: '75px', padding: '3px 5px', fontSize: '12px', background: '#1a1a2e', color: '#fff', border: '1px solid #00f2fe', borderRadius: '4px' }}
                  />
                  <button onClick={handleUpdateBudget} style={{ background: '#00f2fe', color: '#000', border: 'none', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✓</button>
                  <button onClick={() => setIsEditingBudget(false)} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                </div>
              )}

              {/* NEW RESET BUTTON CONFIGURATION */}
              <button 
                type="button"
                onClick={handleClearAllExpenses}
                style={{ 
                  background: 'rgba(255, 75, 75, 0.12)', 
                  border: '1px solid #ff4b4b', 
                  borderRadius: '4px', 
                  color: '#ff4b4b', 
                  padding: '3px 8px', 
                  cursor: 'pointer', 
                  fontSize: '11px', 
                  fontWeight: 'bold' 
                }}
              >
                🗑️ Clear
              </button>
            </div>
          </div>
          <hr style={{ opacity: 0.1, marginBottom: '20px', marginTop: '10px' }} />
          
          <div style={{ marginBottom: '20px' }}>
            <span style={{ fontSize: '12px', opacity: 0.7, letterSpacing: '1px' }}>TOTAL SPENT</span>
            <h1 style={{ fontSize: '36px', margin: '5px 0 0 0', color: totals.total_spent > budgetLimit ? '#ff4b4b' : '#00f2fe' }}>
              ₹{totals.total_spent}
            </h1>
          </div>

          {budgetLimit > 0 && (
            <div style={{ marginBottom: '25px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                <span style={{ opacity: 0.6 }}>Monthly Limit: <strong>₹{budgetLimit}</strong></span>
                <span style={{ 
                  fontWeight: 'bold', 
                  color: usagePercentage >= 90 ? '#ff4b4b' : usagePercentage >= 75 ? '#ff9f43' : '#00f2fe'
                }}>
                  {Math.round(usagePercentage)}% Used
                </span>
              </div>
              
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${Math.min(usagePercentage, 100)}%`, 
                  height: '100%', 
                  borderRadius: '4px',
                  transition: 'width 0.5s ease-in-out',
                  background: usagePercentage >= 90 
                    ? 'linear-gradient(90deg, #ff4b4b, #ff7675)' 
                    : usagePercentage >= 75 
                    ? 'linear-gradient(90deg, #ff9f43, #feca57)' 
                    : 'linear-gradient(90deg, #00f2fe, #4facfe)'
                }} />
              </div>

              {totals.total_spent > budgetLimit && (
                <div style={{ marginTop: '10px', fontSize: '11px', color: '#ff4b4b', fontWeight: 'bold' }}>
                  ⚠️ Warning: Budget threshold limit exceeded!
                </div>
              )}
            </div>
          )}

        <h3>Category Wise</h3>
<div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
  {(() => {
    // 1. Remove duplicate API string variations (keep only one clean version per category)
    const normalizedBreakdown = {};
    Object.entries(totals.breakdown || {}).forEach(([category, amount]) => {
      const cleanKey = category.trim().toLowerCase();
      // Ensure we record the real numeric value if multiple matching variants exist
      if (!normalizedBreakdown[cleanKey] || amount > normalizedBreakdown[cleanKey]) {
        normalizedBreakdown[cleanKey] = amount;
      }
    });

    // 2. Loop through the cleaned dataset
    return Object.entries(normalizedBreakdown).map(([category, amount]) => (
      <div 
        key={category} 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.05)', 
          paddingBottom: '5px',
          width: '100%' // Prevents horizontal dropping out of card bounds
        }}
      >
        <span style={{ textTransform: 'capitalize' }}>📁 {category}</span>
        <strong style={{ color: '#00f2fe', marginLeft: '10px', minWidth: '70px', textAlign: 'right' }}>
          ₹{amount}
        </strong>
      </div>
    ));
  })()}
</div>
        </div>

        {/* CARD 3: Charts */}
        <div className="glass-card" style={{ flex: '1 1 350px', maxWidth: '380px', height: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
          <h2 style={{ marginTop: 0, alignSelf: 'flex-start', width: '100%', textAlign: 'left' }}>Visual Split</h2>
          <hr style={{ opacity: 0.1, marginBottom: '10px', width: '100%' }} />
          
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#16213e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#00f2fe' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ opacity: 0.5 }}>No graphical records to display.</p>
          )}
        </div>

      </div>
      
      {/* LOWER PANEL: Advisor Insights + Activities + Gamification */}
      <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap', width: '100%' }}>
        
        {/* COLUMN 1: Gamification Metrics targets */}
        <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <GamificationPanel getAuthConfig={getAuthConfig} refreshDashboard={fetchSummaryData} />
        </div>
        
        {/* COLUMN 2: Smart Advisor Advice */}
        <div className="glass-card" style={{ flex: '1 1 450px', textAlign: 'left', borderLeft: '4px solid #b5179e' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ marginTop: 0, color: '#fff' }}>💡 Smart Financial Coach</h2>
            {loadingAdvice && <span style={{ fontSize: '12px', color: '#b5179e' }}>Analyzing...</span>}
          </div>
          <hr style={{ opacity: 0.1, marginBottom: '15px' }} />
          
          <div style={{ lineHeight: '1.7', fontSize: '15px', color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap' }}>
            {advice}
          </div>
        </div>

        {/* COLUMN 3: Recent Activities list */}
        <div className="glass-card" style={{ flex: '2 1 600px', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Recent Activities</h2>
            <button 
              onClick={downloadCSV}
              style={{
                background: 'rgba(0, 242, 254, 0.1)',
                color: '#00f2fe',
                border: '1px solid #00f2fe',
                padding: '6px 14px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 'bold',
                transition: '0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = 'rgba(0, 242, 254, 0.2)'}
              onMouseOut={(e) => e.target.style.background = 'rgba(0, 242, 254, 0.1)'}
            >
              📥 Export CSV
            </button>
          </div>
          <hr style={{ opacity: 0.1, marginBottom: '15px', marginTop: '10px' }} />
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentExpenses.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div>
                  <strong style={{ fontSize: '16px', textTransform: 'capitalize' }}>{item.title}</strong>
                  <span style={{ fontSize: '12px', opacity: 0.5, marginLeft: '15px', background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '4px', textTransform: 'capitalize' }}>
                    {item.category}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <span style={{ fontSize: '18px', color: '#00f2fe', fontWeight: 'bold' }}>₹{item.amount}</span>
                  <button onClick={() => handleDelete(item.id)} style={{ background: 'rgba(255, 75, 75, 0.2)', color: '#ff4b4b', border: '1px solid #ff4b4b', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {recentExpenses.length === 0 && <p style={{ opacity: 0.5 }}>No recorded logs found.</p>}
          </div>
        </div>

      </div>

    </div>
  );
}

export default App;

// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
// import Login from './Login'; 
// import './App.css';
// import ReceiptScanner from './ReceiptScanner';
// import GamificationPanel from './GamificationPanel';

// function App() {
//   const [userInput, setUserInput] = useState("");
//   const [aiResult, setAiResult] = useState(null);
//   const [totals, setTotals] = useState({ total_spent: 0, breakdown: {} });
//   const [recentExpenses, setRecentExpenses] = useState([]);
//   const [isListening, setIsListening] = useState(false);
  
//   // State for tracking smart financial coaching insights
//   const [advice, setAdvice] = useState("Loading financial strategy...");
//   const [loadingAdvice, setLoadingAdvice] = useState(false);

//   // Authentication status states
//   const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('token'));
//   const [currentUsername, setCurrentUsername] = useState(localStorage.getItem('username') || "");

//   // Budget Tracking State Additions
//   const [budgetLimit, setBudgetLimit] = useState(0);
//   const [newBudgetInput, setNewBudgetInput] = useState("");
//   const [isEditingBudget, setIsEditingBudget] = useState(false);

//   const getAuthConfig = () => {
//     const token = localStorage.getItem('token');
//     return {
//       headers: {
//         Authorization: `Bearer ${token}`
//       }
//     };
//   };

//   // Fetches personalized insight rules from Django
//   const fetchAdvisorAdvice = async () => {
//     setLoadingAdvice(true);
//     try {
//       const response = await axios.get('http://127.0.0.1:8000/api/expenses/advisor/', getAuthConfig());
//       if (response.data.status === 'success') {
//         setAdvice(response.data.advice);
//       }
//     } catch (error) {
//       console.error("Error fetching financial advisory tips:", error);
//       setAdvice("Could not generate active insights. Try refreshing the panel.");
//     } finally {
//       setLoadingAdvice(false);
//     }
//   };

//   const fetchSummaryData = async () => {
//     try {
//       const response = await axios.get('http://127.0.0.1:8000/api/expenses/summary/', getAuthConfig());
//       if (response.data.status === 'success') {
//         setTotals({
//           total_spent: response.data.total_spent,
//           breakdown: response.data.breakdown
//         });
//         setBudgetLimit(response.data.budget_limit || 0); // Synchronize budget metrics state
//         setRecentExpenses(response.data.recent_expenses);
//       }
//     } catch (error) {
//       console.error("Error fetching dashboard metrics:", error);
//       if (error.response?.status === 403 || error.response?.status === 401) {
//         handleLogout();
//       }
//     }
//   };

//   // Triggered automatically on login state sync
//   useEffect(() => {
//     if (isLoggedIn) {
//       fetchSummaryData();
//       fetchAdvisorAdvice(); 
//     }
//   }, [isLoggedIn]);

//   // Speech Recognition Engine Configuration
//   const handleVoiceInput = () => {
//     const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
//     if (!SpeechRecognition) {
//       alert("Voice control is not supported by your current browser profile. Switch to Google Chrome!");
//       return;
//     }

//     const recognition = new SpeechRecognition();
//     recognition.lang = 'en-IN'; 
//     recognition.interimResults = false; 
//     recognition.maxAlternatives = 1;

//     recognition.onstart = () => {
//       setIsListening(true);
//     };

//     recognition.onresult = (event) => {
//       const voiceText = event.results[0][0].transcript;
//       console.log("Speech-To-Text Transcription Log:", voiceText);
//       setUserInput(voiceText); 
//     };

//     recognition.onerror = (err) => {
//       console.error("Speech structural processing error:", err);
//       setIsListening(false);
//     };

//     recognition.onend = () => {
//       setIsListening(false);
//     };

//     recognition.start();
//   };

//   const handleAnalyze = async () => {
//     if (!userInput.trim()) return;
//     try {
//       const response = await axios.post('http://127.0.0.1:8000/api/expenses/add-ai/', {
//         text: userInput
//       }, getAuthConfig());
      
//       setAiResult(response.data.data);
//       fetchSummaryData();
//       fetchAdvisorAdvice(); 
//       setUserInput(""); 
//     } catch (error) {
//       console.error("Error connecting to Django:", error);
//     }
//   };

//   const handleDelete = async (id) => {
//     try {
//       const response = await axios.delete(`http://127.0.0.1:8000/api/expenses/delete/${id}/`, getAuthConfig());
//       if (response.data.status === 'success') {
//         fetchSummaryData();
//         fetchAdvisorAdvice(); 
//       }
//     } catch (error) {
//       console.error("Failed deleting row item:", error);
//     }
//   };

//   // Updates the user's budget threshold configurations via API
//   const handleUpdateBudget = async () => {
//     if (!newBudgetInput || isNaN(newBudgetInput)) return;
//     try {
//       const config = {
//         headers: {
//           ...getAuthConfig().headers,
//           'Content-Type': 'application/json'
//         }
//       };

//       const response = await axios.post(
//         'http://127.0.0.1:8000/api/expenses/update-budget/', 
//         { budget_limit: parseFloat(newBudgetInput) }, 
//         config
//       );

//       if (response.data.status === 'success') {
//         setBudgetLimit(parseFloat(newBudgetInput));
//         setIsEditingBudget(false);
//         fetchSummaryData(); // Refresh the analytics card automatically
//       }
//     } catch (error) {
//       console.error("Error updating budget metrics limit settings:", error.response?.data || error);
//       alert("Failed to update budget. Check console for error details.");
//     }
//   };

//   // Fixed CSV Download Function with Binary UTF-8 BOM injection
//   const downloadCSV = () => {
//     if (recentExpenses.length === 0) {
//       alert("No transaction records available to export!");
//       return;
//     }

//     const headers = ["Transaction ID", "Title", "Category", "Amount (₹)"];
    
//     const rows = recentExpenses.map(item => [
//       item.id,
//       `"${item.title.replace(/"/g, '""')}"`, 
//       item.category,
//       item.amount
//     ]);

//     const csvContent = [
//       headers.join(","), 
//       ...rows.map(e => e.join(","))
//     ].join("\n");

//     const encoder = new TextEncoder();
//     const csvBytes = encoder.encode(csvContent);
//     const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    
//     const totalBytes = new Uint8Array(bom.length + csvBytes.length);
//     totalBytes.set(bom, 0);
//     totalBytes.set(csvBytes, bom.length);

//     const blob = new Blob([totalBytes], { type: 'text/csv;charset=utf-8;' });
//     const url = URL.createObjectURL(blob);
//     const link = document.createElement("a");
//     link.setAttribute("href", url);
//     link.setAttribute("download", `FlashFinance_Report_${new Date().toISOString().split('T')[0]}.csv`);
//     link.style.visibility = 'hidden';
//     document.body.appendChild(link);
//     link.click();
//     document.body.removeChild(link);
//   };

//   const handleLogout = () => {
//     localStorage.removeItem('token');
//     localStorage.removeItem('username');
//     setIsLoggedIn(false);
//     setCurrentUsername("");
//     setTotals({ total_spent: 0, breakdown: {} });
//     setRecentExpenses([]);
//     setAiResult(null);
//     setAdvice("");
//   };

//   const handleLoginSuccess = () => {
//     setIsLoggedIn(true);
//     setCurrentUsername(localStorage.getItem('username') || "");
//   };

//   if (!isLoggedIn) {
//     return <Login onLoginSuccess={handleLoginSuccess} />;
//   }

//   const chartData = Object.entries(totals.breakdown).map(([category, amount]) => ({
//     name: category,
//     value: amount
//   })).filter(item => item.value > 0);

//   const COLORS = ['#00f2fe', '#4facfe', '#b5179e', '#7209b7', '#f72585', '#4cc9f0'];
//   const usagePercentage = budgetLimit > 0 ? (totals.total_spent / budgetLimit) * 100 : 0;

//   return (
//     <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      
//       {/* Header Panel */}
//       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: 'rgba(255,255,255,0.02)', padding: '15px 30px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
//         <div>
//           <h2 style={{ margin: 0, fontSize: '20px' }}>Hello, <span style={{ color: '#00f2fe' }}>{currentUsername}</span> 👋</h2>
//           <span style={{ fontSize: '12px', opacity: 0.5 }}>Personalized Expense Workspace</span>
//         </div>
//         <button onClick={handleLogout} style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}>
//           Log Out
//         </button>
//       </div>

//       {/* Main App Workspace */}
//       <div className="App" style={{ display: 'flex', gap: '25px', justifyContent: 'center', alignItems: 'flex-start', marginBottom: '30px', flexWrap: 'wrap' }}>
        
//         {/* LEFT COLUMN: AI Inputs Sequence */}
//         <div style={{ flex: '1 1 400px', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '25px' }}>
          
//           {/* Original Input Card */}
//           <div className="glass-card" style={{ width: '100%', boxSizing: 'border-box' }}>
//             <h1>FlashFinance Pro</h1>
//             <p>AI-Powered Expense Tracker</p>
            
//             <div style={{ position: 'relative', width: '100%' }}>
//               <input 
//                 type="text" 
//                 placeholder="e.g., Spent 500 on pizza" 
//                 value={userInput}
//                 onChange={(e) => setUserInput(e.target.value)}
//                 style={{ width: '100%', paddingRight: '45px', boxSizing: 'border-box' }}
//               />
              
//               <button 
//                 onClick={handleVoiceInput}
//                 style={{
//                   position: 'absolute',
//                   right: '10px',
//                   top: '50%',
//                   transform: 'translateY(-50%)',
//                   background: 'none',
//                   border: 'none',
//                   fontSize: '18px',
//                   cursor: 'pointer',
//                   color: isListening ? '#f72585' : '#00f2fe',
//                   animation: isListening ? 'pulse 1.5s infinite' : 'none',
//                   padding: '5px'
//                 }}
//                 title="Speak your transaction"
//               >
//                 {isListening ? "🛑" : "🎙️"}
//               </button>
//             </div>
            
//             <button className="btn" onClick={handleAnalyze} style={{ width: '100%', marginTop: '10px' }}>
//               Analyze with AI
//             </button>

//             {aiResult && (
//               <div className="result-area" style={{ textAlign: 'left' }}>
//                 <h3>AI Analysis:</h3>
//                 <p><strong>Title:</strong> {aiResult.title}</p>
//                 <p><strong>Amount:</strong> ₹{aiResult.amount}</p>
//                 <p><strong>Category:</strong> {aiResult.category}</p>
//               </div>
//             )}
//           </div>

//           {/* Image Receipt Scanner Card */}
//           <div className="glass-card" style={{ width: '100%', padding: '5px', boxSizing: 'border-box' }}>
//             <ReceiptScanner />
//           </div>

//         </div>

//         {/* CARD 2: Dashboard Analytics */}
//         <div className="glass-card" style={{ flex: '1 1 350px', maxWidth: '380px', textAlign: 'left' }}>
//           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//             <h2 style={{ marginTop: 0, marginBottom: 0 }}>Analytics</h2>
            
//             {!isEditingBudget ? (
//               <span 
//                 onClick={() => { setIsEditingBudget(true); setNewBudgetInput(budgetLimit); }}
//                 style={{ fontSize: '12px', color: '#00f2fe', cursor: 'pointer', opacity: 0.8 }}
//               >
//                 ⚙️ Set Limit
//               </span>
//             ) : (
//               <div style={{ display: 'flex', gap: '5px' }}>
//                 <input 
//                   type="number" 
//                   value={newBudgetInput} 
//                   onChange={(e) => setNewBudgetInput(e.target.value)}
//                   style={{ width: '75px', padding: '3px 5px', fontSize: '12px', background: '#1a1a2e', color: '#fff', border: '1px solid #00f2fe', borderRadius: '4px' }}
//                 />
//                 <button onClick={handleUpdateBudget} style={{ background: '#00f2fe', color: '#000', border: 'none', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>✓</button>
//                 <button onClick={() => setIsEditingBudget(false)} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', padding: '3px 7px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
//               </div>
//             )}
//           </div>
//           <hr style={{ opacity: 0.1, marginBottom: '20px', marginTop: '10px' }} />
          
//           <div style={{ marginBottom: '20px' }}>
//             <span style={{ fontSize: '12px', opacity: 0.7, letterSpacing: '1px' }}>TOTAL SPENT</span>
//             <h1 style={{ fontSize: '36px', margin: '5px 0 0 0', color: totals.total_spent > budgetLimit ? '#ff4b4b' : '#00f2fe' }}>
//               ₹{totals.total_spent}
//             </h1>
//           </div>

//           {budgetLimit > 0 && (
//             <div style={{ marginBottom: '25px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
//               <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
//                 <span style={{ opacity: 0.6 }}>Monthly Limit: <strong>₹{budgetLimit}</strong></span>
//                 <span style={{ 
//                   fontWeight: 'bold', 
//                   color: usagePercentage >= 90 ? '#ff4b4b' : usagePercentage >= 75 ? '#ff9f43' : '#00f2fe'
//                 }}>
//                   {Math.round(usagePercentage)}% Used
//                 </span>
//               </div>
              
//               <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
//                 <div style={{ 
//                   width: `${Math.min(usagePercentage, 100)}%`, 
//                   height: '100%', 
//                   borderRadius: '4px',
//                   transition: 'width 0.5s ease-in-out',
//                   background: usagePercentage >= 90 
//                     ? 'linear-gradient(90deg, #ff4b4b, #ff7675)' 
//                     : usagePercentage >= 75 
//                     ? 'linear-gradient(90deg, #ff9f43, #feca57)' 
//                     : 'linear-gradient(90deg, #00f2fe, #4facfe)'
//                 }} />
//               </div>

//               {totals.total_spent > budgetLimit && (
//                 <div style={{ marginTop: '10px', fontSize: '11px', color: '#ff4b4b', fontWeight: 'bold' }}>
//                   ⚠️ Warning: Budget threshold limit exceeded!
//                 </div>
//               )}
//             </div>
//           )}

//           <h3>Category Wise</h3>
//           <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
//             {Object.entries(totals.breakdown).map(([category, amount]) => (
//               <div key={category} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '5px', textTransform: 'capitalize' }}>
//                 <span>📁 {category}</span> <strong>₹{amount}</strong>
//               </div>
//             ))}
//           </div>
//         </div>

//         {/* CARD 3: Charts */}
//         <div className="glass-card" style={{ flex: '1 1 350px', maxWidth: '380px', height: '340px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
//           <h2 style={{ marginTop: 0, alignSelf: 'flex-start', width: '100%', textAlign: 'left' }}>Visual Split</h2>
//           <hr style={{ opacity: 0.1, marginBottom: '10px', width: '100%' }} />
          
//           {chartData.length > 0 ? (
//             <ResponsiveContainer width="100%" height={260}>
//               <PieChart>
//                 <Pie data={chartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
//                   {chartData.map((entry, index) => (
//                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
//                   ))}
//                 </Pie>
//                 <Tooltip contentStyle={{ background: '#16213e', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#fff' }} itemStyle={{ color: '#00f2fe' }} />
//               </PieChart>
//             </ResponsiveContainer>
//           ) : (
//             <p style={{ opacity: 0.5 }}>No graphical records to display.</p>
//           )}
//         </div>

//       </div>
      
//       {/* LOWER PANEL: Advisor Insights + Activities + Gamification */}
//       <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap', width: '100%' }}>
        
//         {/* COLUMN 1: Gamification Metrics targets */}
//         <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
//           <GamificationPanel getAuthConfig={getAuthConfig} refreshDashboard={fetchSummaryData} />
//         </div>
        
//         {/* COLUMN 2: Smart Advisor Advice */}
//         <div className="glass-card" style={{ flex: '1 1 450px', textAlign: 'left', borderLeft: '4px solid #b5179e' }}>
//           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//             <h2 style={{ marginTop: 0, color: '#fff' }}>💡 Smart Financial Coach</h2>
//             {loadingAdvice && <span style={{ fontSize: '12px', color: '#b5179e' }}>Analyzing...</span>}
//           </div>
//           <hr style={{ opacity: 0.1, marginBottom: '15px' }} />
          
//           <div style={{ lineHeight: '1.7', fontSize: '15px', color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap' }}>
//             {advice}
//           </div>
//         </div>

//         {/* COLUMN 3: Recent Activities list */}
//         <div className="glass-card" style={{ flex: '2 1 600px', textAlign: 'left' }}>
//           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//             <h2>Recent Activities</h2>
//             <button 
//               onClick={downloadCSV}
//               style={{
//                 background: 'rgba(0, 242, 254, 0.1)',
//                 color: '#00f2fe',
//                 border: '1px solid #00f2fe',
//                 padding: '6px 14px',
//                 borderRadius: '6px',
//                 cursor: 'pointer',
//                 fontSize: '13px',
//                 fontWeight: 'bold',
//                 transition: '0.2s'
//               }}
//               onMouseOver={(e) => e.target.style.background = 'rgba(0, 242, 254, 0.2)'}
//               onMouseOut={(e) => e.target.style.background = 'rgba(0, 242, 254, 0.1)'}
//             >
//               📥 Export CSV
//             </button>
//           </div>
//           <hr style={{ opacity: 0.1, marginBottom: '15px', marginTop: '10px' }} />
          
//           <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
//             {recentExpenses.map((item) => (
//               <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
//                 <div>
//                   <strong style={{ fontSize: '16px', textTransform: 'capitalize' }}>{item.title}</strong>
//                   <span style={{ fontSize: '12px', opacity: 0.5, marginLeft: '15px', background: 'rgba(255,255,255,0.1)', padding: '3px 8px', borderRadius: '4px', textTransform: 'capitalize' }}>
//                     {item.category}
//                   </span>
//                 </div>
//                 <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
//                   <span style={{ fontSize: '18px', color: '#00f2fe', fontWeight: 'bold' }}>₹{item.amount}</span>
//                   <button onClick={() => handleDelete(item.id)} style={{ background: 'rgba(255, 75, 75, 0.2)', color: '#ff4b4b', border: '1px solid #ff4b4b', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
//                     Delete
//                   </button>
//                 </div>
//               </div>
//             ))}
//             {recentExpenses.length === 0 && <p style={{ opacity: 0.5 }}>No recorded logs found.</p>}
//           </div>
//         </div>

//       </div>

//     </div>
//   );
// }

// export default App;




