import React, { useEffect } from 'react';
import { playWarningKlaxon } from '../speechBlip';

/**
 * Cinematic warning that the sergeant suspects lurking bugs.
 * Renders between the boot screen and training splash.
 * Plays a military klaxon alarm on mount.
 */
const SuspicionAlert: React.FC = () => {
    // Play warning klaxon alarm when suspicion alert appears
    useEffect(() => {
        const cleanup = playWarningKlaxon();
        return cleanup;
    }, []);

    return (
        <div className="suspicion-alert" role="alert" aria-live="assertive">
            <div className="suspicion-alert__badge">CODE WATCH</div>
            <div className="suspicion-alert__headline">SERGEANT IS SUSPICIOUS</div>
            <p className="suspicion-alert__subtext">
                Sensors picked up irregular stack traces. There may be bugs hiding in your code — stay sharp.
            </p>
            <div className="suspicion-alert__scanner">
                <div className="suspicion-alert__scanner-grid">
                    {Array.from({ length: 12 }).map((_, idx) => (
                        <span key={idx} className="suspicion-alert__scanner-dot" />
                    ))}
                </div>
                <div className="suspicion-alert__scanner-line" />
            </div>
            <div className="suspicion-alert__cta">Prepare to squash anything that twitches.</div>
        </div>
    );
};

export default SuspicionAlert;
