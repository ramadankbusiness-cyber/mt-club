import React from "react";
import "./NeonButton.css";

export default function NeonFeatureButton({ children = "Discover features", onClick }) {
  return (
    <button id="bottone1" onClick={onClick}>
      <strong>{children}</strong>
    </button>
  );
}
