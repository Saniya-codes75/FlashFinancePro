import React, { useState, useEffect } from 'react';
import axios from 'axios';

function GamificationPanel({ getAuthConfig, refreshDashboard }) {
  // Input fields state for creating a new goal
  const [targetName, setTargetName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  
  // Dynamic state dictionary to track custom contribution amounts per goal ID
  const [contributions, setContributions] = useState({});
  
  // List of saved targets
  const [targets, setTargets] = useState([]);
  const [streak, setStreak] = useState(0);
  const [personalRecord, setPersonalRecord] = useState(0);

  // Timeframe selector state - Defaults dynamically to the active current calendar month (YYYY-MM)
  const [timeframe, setTimeframe] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  // 1. Fetches data matching your exact Django return fields
  const fetchGamificationData = async () => {
    try {
      const goalsResponse = await axios.get(
        `http://127.0.0.1:8000/api/expenses/savings/?month=${timeframe}`, 
        getAuthConfig()
      );
      const goalsData = goalsResponse.data.goals || [];
      setTargets(goalsData);

      // Fetch User Streak Metrics
      const streakResponse = await axios.get('http://127.0.0.1:8000/api/expenses/streak/', getAuthConfig());
      setStreak(streakResponse.data.current_streak || 0);
      setPersonalRecord(streakResponse.data.longest_streak || 0);

    } catch (error) {
      console.error("Error fetching gamification data:", error);
    }
  };

  useEffect(() => {
    fetchGamificationData();
  }, [timeframe]);
    
  // 2. Handles adding a new target
  const handleAddTargetDirectly = async () => {
    if (!targetName.trim() || !targetAmount.trim()) {
      alert("Please enter both a target name and amount!");
      return;
    }

    const payload = { 
      title: targetName, 
      target_amount: parseFloat(targetAmount) 
    };

    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/api/expenses/savings/',
        payload,
        getAuthConfig()
      );

      if (response.data && response.data.status === 'error') {
        alert(`Backend rejected: ${response.data.message}`);
        return;
      }
      
      setTargetName(''); 
      setTargetAmount(''); 
      
      await fetchGamificationData();
      if (refreshDashboard) refreshDashboard();

    } catch (err) {
      console.error("Network submission error occurred:", err);
      alert("Failed to save target.");
    }
  };

  // 3. Handles contributing money using PUT method
  const handleContributeToGoal = async (goalId) => {
    const amountStr = contributions[goalId];
    if (!amountStr || !amountStr.trim() || parseFloat(amountStr) <= 0) {
      alert("Please enter a valid amount to contribute!");
      return;
    }

    const depositAmount = parseFloat(amountStr);

    try {
      const response = await axios.put(
        'http://127.0.0.1:8000/api/expenses/savings/',
        { 
          goal_id: goalId, 
          amount: depositAmount 
        },
        getAuthConfig()
      );

      if (response.data && response.data.status === 'success') {
        setContributions(prev => ({ ...prev, [goalId]: '' }));
        
        await fetchGamificationData();
        if (refreshDashboard) refreshDashboard();
        
        if (response.data.is_completed) {
          alert("🎉 Congratulations! You've achieved this savings goal target!");
        }
      } else {
        alert(response.data.message || "Failed to process contribution.");
      }
    } catch (error) {
      console.error("Error updating goal progress:", error);
      alert("Failed to add contribution.");
    }
  };

  const handleContributionInputChange = (goalId, value) => {
    setContributions(prev => ({
      ...prev,
      [goalId]: value
    }));
  };

  // 4. Handles removing an item individual row
  const handleDeleteTarget = async (id) => {
    try {
      await axios.delete('http://127.0.0.1:8000/api/expenses/savings/', {
        ...getAuthConfig(),
        data: { goal_id: id }
      });
      
      fetchGamificationData();
      if (refreshDashboard) refreshDashboard();
    } catch (error) {
      console.error("Error deleting target:", error);
      alert("Failed to delete the savings goal.");
    }
  };

  // 5. NEW: Handles clearing all records for the active month at once
  const handleBulkClearMonth = async () => {
    const confirmClear = window.confirm(`Are you sure you want to delete ALL savings goals for ${timeframe}? This cannot be undone.`);
    if (!confirmClear) return;

    try {
      const response = await axios.post(
        'http://127.0.0.1:8000/api/expenses/bulk_delete_old_records/',
        { target_month: timeframe },
        getAuthConfig()
      );

      if (response.data && response.data.status === 'success') {
        alert(response.data.message);
        await fetchGamificationData();
      } else {
        alert(response.data.message || "Failed to clear records.");
      }
    } catch (error) {
      console.error("Error during bulk delete:", error);
      if (error.response && error.response.data) {
        alert(`Failed: ${error.response.data.message}`);
      } else {
        alert("Failed to clear records. Verify backend connection endpoints configuration patterns.");
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
      {/* Savings Streak Card */}
      <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(255, 75, 75, 0.1), rgba(114, 9, 183, 0.15))', borderLeft: '4px solid #ff4b4b' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '40px' }}>🔥</span>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ margin: 0, fontSize: '22px', color: '#fff' }}>Savings Streak</h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
              Current Streak: <strong style={{ color: '#ff4b4b' }}>{streak} days</strong> | Personal Record: {personalRecord} days
            </p>
          </div>
        </div>
      </div>

      {/* Dynamic Month Tracker Selector Interface */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>🗓️ Active Ledger Period:</span>
        
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input 
            type="month" 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)} 
            style={{
              padding: '8px 14px',
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              color: '#00f2fe',
              fontWeight: 'bold',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
          
          <button
            type="button"
            onClick={handleBulkClearMonth}
            style={{
              padding: '8px 14px',
              background: 'rgba(255, 75, 75, 0.15)',
              border: '1px solid #ff4b4b',
              borderRadius: '6px',
              color: '#ff4b4b',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            🗑️ Clear Month
          </button>
        </div>
      </div>

      {/* Target Savings Goals Card */}
      <div className="glass-card" style={{ textAlign: 'left' }}>
        <h2 style={{ marginTop: 0, color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '10px' }}>
          🎯 Target Savings Goals
        </h2>
        <hr style={{ opacity: 0.1, marginBottom: '20px' }} />

        {/* Input Layout */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="e.g., smart phone" 
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            style={{ flex: '2 1 150px', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }}
          />
          <input 
            type="number" 
            placeholder="Amount" 
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            style={{ flex: '1 1 100px', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }}
          />
          <button 
            type="button" 
            onClick={handleAddTargetDirectly}
            className="btn" 
            style={{ background: 'linear-gradient(90deg, #00f2fe, #4facfe)', color: '#000', fontWeight: 'bold', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}
          >
            Add Target
          </button>
        </div>

        {/* Display Targets List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {targets && targets.length > 0 ? (
            targets.map((target) => {
              const current = parseFloat(target.current_amount || 0);
              const total = parseFloat(target.target_amount || 1);
              const percentage = Math.min(Math.round((current / total) * 100), 100);

              return (
                <div key={target.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: target.is_completed ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.05)' }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ textAlign: 'left' }}>
                      <strong style={{ textTransform: 'capitalize', color: '#fff', fontSize: '16px' }}>
                        {target.title || "Savings Goal"} {target.is_completed && '✅'}
                      </strong>
                      <div style={{ fontSize: '13px', opacity: 0.6, marginTop: '2px' }}>
                        Target: ₹{total} | Saved: <span style={{ color: '#00f2fe', fontWeight: 'bold' }}>₹{current}</span> ({percentage}%)
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => handleDeleteTarget(target.id)} 
                      style={{ background: 'none', border: 'none', color: '#ff4b4b', cursor: 'pointer', fontSize: '14px', marginLeft: '10px' }}
                      title="Remove Target"
                    >
                      🗑️
                    </button>
                  </div>

                  <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '10px', overflow: 'hidden' }}>
                    <div style={{ width: `${percentage}%`, height: '100%', background: 'linear-gradient(90deg, #00f2fe, #4facfe)', transition: 'width 0.4s ease' }} />
                  </div>

                  {!target.is_completed && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center', justifyContent: 'flex-start' }}>
                      <input 
                        type="number" 
                        placeholder="Add savings amount..." 
                        value={contributions[target.id] || ''}
                        onChange={(e) => handleContributionInputChange(target.id, e.target.value)}
                        style={{ width: '140px', padding: '6px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
                      />
                      <button 
                        type="button"
                        onClick={() => handleContributeToGoal(target.id)}
                        style={{ padding: '6px 12px', background: 'rgba(0, 242, 254, 0.15)', border: '1px solid #00f2fe', color: '#00f2fe', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                      >
                        💵 Save
                      </button>
                    </div>
                  )}

                </div>
              );
            })
          ) : (
            <p style={{ opacity: 0.5, fontSize: '14px', margin: 0 }}>No historical metrics configured for this ledger period.</p>
          )}
        </div>

      </div>
    </div>
  );
}

export default GamificationPanel;


// import React, { useState, useEffect } from 'react';
// import axios from 'axios';

// function GamificationPanel({ getAuthConfig, refreshDashboard }) {
//   // Input fields state for creating a new goal
//   const [targetName, setTargetName] = useState('');
//   const [targetAmount, setTargetAmount] = useState('');
  
//   // Dynamic state dictionary to track custom contribution amounts per goal ID
//   const [contributions, setContributions] = useState({});
  
//   // List of saved targets
//   const [targets, setTargets] = useState([]);
//   const [streak, setStreak] = useState(0);
//   const [personalRecord, setPersonalRecord] = useState(0);

//   // Timeframe selector state - Defaults dynamically to the active current calendar month (YYYY-MM)
//   const [timeframe, setTimeframe] = useState(() => {
//     const today = new Date();
//     const year = today.getFullYear();
//     const month = String(today.getMonth() + 1).padStart(2, '0');
//     return `${year}-${month}`;
//   });

//   // 1. Fetches data matching your exact Django return fields
//   const fetchGamificationData = async () => {
//     try {
//       // Appends the active target month directly into the URL query parameters
//       const goalsResponse = await axios.get(
//         `http://127.0.0.1:8000/api/expenses/savings/?month=${timeframe}`, 
//         getAuthConfig()
//       );
//       const goalsData = goalsResponse.data.goals || [];
//       setTargets(goalsData);

//       // Fetch User Streak Metrics
//       const streakResponse = await axios.get('http://127.0.0.1:8000/api/expenses/streak/', getAuthConfig());
//       setStreak(streakResponse.data.current_streak || 0);
//       setPersonalRecord(streakResponse.data.longest_streak || 0);

//     } catch (error) {
//       console.error("Error fetching gamification data:", error);
//     }
//   };

//   // Triggers automated backend sync data pulls whenever a user updates the month timeline sheet window
//   useEffect(() => {
//     fetchGamificationData();
//   }, [timeframe]);
    
//   // 2. Handles adding a new target
//   const handleAddTargetDirectly = async () => {
//     if (!targetName.trim() || !targetAmount.trim()) {
//       alert("Please enter both a target name and amount!");
//       return;
//     }

//     const payload = { 
//       title: targetName, 
//       target_amount: parseFloat(targetAmount) 
//     };

//     try {
//       const response = await axios.post(
//         'http://127.0.0.1:8000/api/expenses/savings/',
//         payload,
//         getAuthConfig()
//       );

//       if (response.data && response.data.status === 'error') {
//         alert(`Backend rejected: ${response.data.message}`);
//         return;
//       }
      
//       setTargetName(''); 
//       setTargetAmount(''); 
      
//       await fetchGamificationData();
//       if (refreshDashboard) refreshDashboard();

//     } catch (err) {
//       console.error("Network submission error occurred:", err);
//       alert("Failed to save target.");
//     }
//   };

//   // 3. Handles contributing money using PUT method to avoid URL param mismatches
//   const handleContributeToGoal = async (goalId) => {
//     const amountStr = contributions[goalId];
//     if (!amountStr || !amountStr.trim() || parseFloat(amountStr) <= 0) {
//       alert("Please enter a valid amount to contribute!");
//       return;
//     }

//     const depositAmount = parseFloat(amountStr);

//     try {
//       const response = await axios.put(
//         'http://127.0.0.1:8000/api/expenses/savings/',
//         { 
//           goal_id: goalId, 
//           amount: depositAmount 
//         },
//         getAuthConfig()
//       );

//       if (response.data && response.data.status === 'success') {
//         setContributions(prev => ({ ...prev, [goalId]: '' }));
        
//         await fetchGamificationData();
//         if (refreshDashboard) refreshDashboard();
        
//         if (response.data.is_completed) {
//           alert("🎉 Congratulations! You've achieved this savings goal target!");
//         }
//       } else {
//         alert(response.data.message || "Failed to process contribution.");
//       }
//     } catch (error) {
//       console.error("Error updating goal progress:", error);
//       alert("Failed to add contribution. Verify your backend views.py handles PUT requests.");
//     }
//   };

//   const handleContributionInputChange = (goalId, value) => {
//     setContributions(prev => ({
//       ...prev,
//       [goalId]: value
//     }));
//   };

//   // 4. Handles removing an item
//   const handleDeleteTarget = async (id) => {
//     try {
//       await axios.delete('http://127.0.0.1:8000/api/expenses/savings/', {
//         ...getAuthConfig(),
//         data: { goal_id: id }
//       });
      
//       fetchGamificationData();
//       if (refreshDashboard) refreshDashboard();
//     } catch (error) {
//       console.error("Error deleting target:", error);
//       alert("Failed to delete the savings goal.");
//     }
//   };

//   return (
//     <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      
//       {/* Savings Streak Card */}
//       <div className="glass-card" style={{ background: 'linear-gradient(135deg, rgba(255, 75, 75, 0.1), rgba(114, 9, 183, 0.15))', borderLeft: '4px solid #ff4b4b' }}>
//         <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
//           <span style={{ fontSize: '40px' }}>🔥</span>
//           <div style={{ textAlign: 'left' }}>
//             <h2 style={{ margin: 0, fontSize: '22px', color: '#fff' }}>Savings Streak</h2>
//             <p style={{ margin: '5px 0 0 0', fontSize: '14px', opacity: 0.8 }}>
//               Current Streak: <strong style={{ color: '#ff4b4b' }}>{streak} days</strong> | Personal Record: {personalRecord} days
//             </p>
//           </div>
//         </div>
//       </div>

//       {/* Dynamic Month Tracker Selector Interface */}
//       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.03)', padding: '12px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
//         <span style={{ color: '#fff', fontSize: '14px', fontWeight: '500' }}>🗓️ Active Ledger Period:</span>
//         <input 
//           type="month" 
//           value={timeframe} 
//           onChange={(e) => setTimeframe(e.target.value)} 
//           style={{
//             padding: '8px 14px',
//             background: 'rgba(0,0,0,0.4)',
//             border: '1px solid rgba(255,255,255,0.15)',
//             borderRadius: '6px',
//             color: '#00f2fe',
//             fontWeight: 'bold',
//             outline: 'none',
//             cursor: 'pointer'
//           }}
//         />
//       </div>

//       {/* Target Savings Goals Card */}
//       <div className="glass-card" style={{ textAlign: 'left' }}>
//         <h2 style={{ marginTop: 0, color: '#00f2fe', display: 'flex', alignItems: 'center', gap: '10px' }}>
//           🎯 Target Savings Goals
//         </h2>
//         <hr style={{ opacity: 0.1, marginBottom: '20px' }} />

//         {/* Input Layout */}
//         <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
//           <input 
//             type="text" 
//             placeholder="e.g., smart phone" 
//             value={targetName}
//             onChange={(e) => setTargetName(e.target.value)}
//             style={{ flex: '2 1 150px', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }}
//           />
//           <input 
//             type="number" 
//             placeholder="Amount" 
//             value={targetAmount}
//             onChange={(e) => setTargetAmount(e.target.value)}
//             style={{ flex: '1 1 100px', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff' }}
//           />
//           <button 
//             type="button" 
//             onClick={handleAddTargetDirectly}
//             className="btn" 
//             style={{ background: 'linear-gradient(90deg, #00f2fe, #4facfe)', color: '#000', fontWeight: 'bold', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}
//           >
//             Add Target
//           </button>
//         </div>

//         {/* Display Targets List */}
//         <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
//           {targets && targets.length > 0 ? (
//             targets.map((target) => {
//               const current = parseFloat(target.current_amount || 0);
//               const total = parseFloat(target.target_amount || 1);
//               const percentage = Math.min(Math.round((current / total) * 100), 100);

//               return (
//                 <div key={target.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '8px', border: target.is_completed ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.05)' }}>
                  
//                   {/* Top Raw Labels Line */}
//                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
//                     <div style={{ textAlign: 'left' }}>
//                       <strong style={{ textTransform: 'capitalize', color: '#fff', fontSize: '16px' }}>
//                         {target.title || "Savings Goal"} {target.is_completed && '✅'}
//                       </strong>
//                       <div style={{ fontSize: '13px', opacity: 0.6, marginTop: '2px' }}>
//                         Target: ₹{total} | Saved: <span style={{ color: '#00f2fe', fontWeight: 'bold' }}>₹{current}</span> ({percentage}%)
//                       </div>
//                     </div>
                    
//                     <button 
//                       onClick={() => handleDeleteTarget(target.id)} 
//                       style={{ background: 'none', border: 'none', color: '#ff4b4b', cursor: 'pointer', fontSize: '14px', marginLeft: '10px' }}
//                       title="Remove Target"
//                     >
//                       🗑️
//                     </button>
//                   </div>

//                   {/* Clean Visual Progress Bar */}
//                   <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginTop: '10px', overflow: 'hidden' }}>
//                     <div style={{ width: `${percentage}%`, height: '100%', background: 'linear-gradient(90deg, #00f2fe, #4facfe)', transition: 'width 0.4s ease' }} />
//                   </div>

//                   {/* Quick Deposit Interactive Controls */}
//                   {!target.is_completed && (
//                     <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center', justifyContent: 'flex-start' }}>
//                       <input 
//                         type="number" 
//                         placeholder="Add savings amount..." 
//                         value={contributions[target.id] || ''}
//                         onChange={(e) => handleContributionInputChange(target.id, e.target.value)}
//                         style={{ width: '140px', padding: '6px 10px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '12px' }}
//                       />
//                       <button 
//                         type="button"
//                         onClick={() => handleContributeToGoal(target.id)}
//                         style={{ padding: '6px 12px', background: 'rgba(0, 242, 254, 0.15)', border: '1px solid #00f2fe', color: '#00f2fe', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
//                       >
//                         💵 Save
//                       </button>
//                     </div>
//                   )}

//                 </div>
//               );
//             })
//           ) : (
//             <p style={{ opacity: 0.5, fontSize: '14px', margin: 0 }}>No historical metrics configured for this ledger period.</p>
//           )}
//         </div>

//       </div>
//     </div>
//   );
// }

// export default GamificationPanel;