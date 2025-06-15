export const DnaLoader = () => {
	const dotsCount = 5;

	const dots = Array.from({ length: dotsCount }, (_, i) => i);

	return (
		<>
			<style>{`
        .dna-loader {
          width: ${dotsCount * 10}px;
          height: 60px;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .dna-loader svg {
          width: 100%;
          height: 100%;
        }
        
        .dot {
          transform-origin: center;
          animation-duration: 0.8s;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-direction: alternate;
        }
        
        .first-strand .dot {
          animation-name: animateFirstDots;
        }
        
        .second-strand .dot {
          animation-name: animateSecondDots;
          animation-direction: alternate-reverse;
        }
        
        ${dots
			.map(
				(_, i) => `
          .dot:nth-child(${i + 1}) { 
            animation-delay: ${(i + 1) * 0.2}s; 
          }
        `,
			)
			.join('')}
        
        @keyframes animateFirstDots {
          0% {
            transform: translateY(8px) scale(0.7);
            fill: #3b82f6;
          }
          100% {
            transform: translateY(-8px) scale(1);
            fill: #8b5cf6;
          }
        }
        
        @keyframes animateSecondDots {
          0% {
            transform: translateY(8px) scale(0.7);
            fill: #f59e0b;
          }
          100% {
            transform: translateY(-8px) scale(1);
            fill: #ef4444;
          }
        }
      `}</style>

			<svg
				viewBox={`0 0 ${dotsCount * 10} 60`}
				xmlns="http://www.w3.org/2000/svg"
			>
				{/* First strand */}
				<g className="first-strand">
					{dots.map((_, i) => (
						<circle
							key={`first-${i}`}
							className="dot"
							cx={5 + i * 10}
							cy="30"
							r="5"
							fill="white"
						/>
					))}
				</g>

				{/* Second strand */}
				<g className="second-strand">
					{dots.map((_, i) => (
						<circle
							key={`second-${i}`}
							className="dot"
							cx={5 + i * 10}
							cy="30"
							r="5"
							fill="white"
						/>
					))}
				</g>
			</svg>
		</>
	);
};

export default DnaLoader;
