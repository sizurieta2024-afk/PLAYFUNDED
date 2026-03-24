"use client";

import { useEffect, useState } from "react";

interface TextGenerateEffectProps {
  words: string;
  className?: string;
  // ms delay between each word appearing
  delayPerWord?: number;
  // ms before animation starts
  startDelay?: number;
}

export function TextGenerateEffect({
  words,
  className = "",
  delayPerWord = 75,
  startDelay = 200,
}: TextGenerateEffectProps) {
  const wordArr = words.split(" ");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), startDelay);
    return () => clearTimeout(timer);
  }, [startDelay]);

  return (
    <span className={className}>
      {wordArr.map((word, i) => (
        <span
          key={i}
          className="inline-block"
          style={{
            marginRight: "0.28em",
            opacity: visible ? 1 : 0,
            filter: visible ? "blur(0px)" : "blur(6px)",
            transform: visible ? "translateY(0)" : "translateY(6px)",
            transition: `opacity 0.5s ease ${startDelay + i * delayPerWord}ms, filter 0.5s ease ${startDelay + i * delayPerWord}ms, transform 0.45s ease ${startDelay + i * delayPerWord}ms`,
          }}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
