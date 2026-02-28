import React from 'react';

/**
 * Short transition splash shown between boot and the coding UI.
 */
const TrainingSplash: React.FC = () => {
  return (
    <div className="training-splash" role="status" aria-live="polite">
      <div className="training-splash__text">Training Time!</div>
    </div>
  );
};

export default TrainingSplash;
