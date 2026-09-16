import React, { useState } from "react";
import { motion, useAnimation, useMotionValue, useTransform } from "framer-motion";

export default function SwipeableRow({ children, renderActions, actionWidth = 80, bg = "var(--paper)", radius = "20px" }) {
  const controls = useAnimation();
  const [isOpen, setIsOpen] = useState(false);
  const x = useMotionValue(0);

  const handleDragEnd = (event, info) => {
    // If they drag past half the action width OR swipe fast enough to the left
    if (info.offset.x < -(actionWidth / 2) || info.velocity.x < -300) {
      controls.start({ x: -actionWidth });
      setIsOpen(true);
    } else {
      controls.start({ x: 0 });
      setIsOpen(false);
    }
  };

  const close = () => {
    controls.start({ x: 0 });
    setIsOpen(false);
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        // User requested: "no card background just dark blue"
        background: "var(--paper)", 
        borderRadius: radius,
        overflow: "hidden", // Ensures nothing bleeds out
      }}
    >
      {/* Actions Layer - sits behind the content */}
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          height: "100%",
          display: "flex",
          width: `${actionWidth}px`,
          zIndex: 0,
          borderTopRightRadius: radius,
          borderBottomRightRadius: radius,
          overflow: "hidden",
        }}
      >
        {renderActions && renderActions({ close })}
      </div>

      {/* Foreground Draggable Content */}
      <motion.div
        drag="x"
        dragDirectionLock={true}
        dragConstraints={{ left: -actionWidth, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{
          touchAction: "pan-y",
          position: "relative",
          zIndex: 1,
          width: "100%",
          background: bg,
          x, // Tie motion value
          borderRadius: radius, // Permanently rounded so it never has a pointy edge!
          overflow: "hidden", // Prevent children backgrounds (like headers) from making corners pointy
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}
