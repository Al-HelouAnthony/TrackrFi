import React, { useState, useEffect } from "react";

export default function LiveSyncTimer({ timestamp }) {
  const [timeAgo, setTimeAgo] = useState("");

  useEffect(() => {
    // If there is no timestamp (e.g., manual Wallet), don't show a timer
    if (!timestamp) {
      setTimeAgo("Manual Sync");
      return;
    }

    const calculateTimeAgo = () => {
      const now = new Date();
      const syncDate = new Date(timestamp);
      const diffInSeconds = Math.floor((now - syncDate) / 1000);

      if (diffInSeconds < 60) {
        setTimeAgo("Synced just now");
      } else if (diffInSeconds < 3600) {
        const mins = Math.floor(diffInSeconds / 60);
        setTimeAgo(`Synced ${mins} min${mins === 1 ? "" : "s"} ago`);
      } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        setTimeAgo(`Synced ${hours} hr${hours === 1 ? "" : "s"} ago`);
      } else {
        const days = Math.floor(diffInSeconds / 86400);
        setTimeAgo(`Synced ${days} day${days === 1 ? "" : "s"} ago`);
      }
    };

    // Calculate the time instantly when the component mounts
    calculateTimeAgo();

    // Recalculate the time every 60 seconds automatically
    const interval = setInterval(calculateTimeAgo, 60000);

    // Clean up the timer if the user leaves the screen
    return () => clearInterval(interval);
  }, [timestamp]);

  return <span className="bank-sync">{timeAgo}</span>;
}
