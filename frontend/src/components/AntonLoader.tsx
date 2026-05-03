import "./AntonLoader.css"

type Props = {
    label?: string
    size?: "sm" | "md" | "lg"
    fullscreen?: boolean
}

export default function AntonLoader({
    label = "Analyzing",
    size = "md",
    fullscreen = false,
}: Props) {
    const dim = size === "sm" ? 40 : size === "md" ? 80 : 140
    const cx = dim / 2
    const cy = dim / 2
    const r = dim * 0.38

    // compute spoke endpoints from center
    const spoke = (angleDeg: number) => {
        const rad = (angleDeg * Math.PI) / 180
        return {
            x1: cx - Math.cos(rad) * r,
            y1: cy - Math.sin(rad) * r,
            x2: cx + Math.cos(rad) * r,
            y2: cy + Math.sin(rad) * r,
        }
    }

    const spokes = [0, 90, 45, 135]

    return (
        <div className={`anton-loader ${fullscreen ? "anton-loader--fullscreen" : ""}`}>
            <div className="anton-loader__mark">
                <svg
                    width={dim}
                    height={dim}
                    viewBox={`0 0 ${dim} ${dim}`}
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    {/* outer ghost ring — slow counter-rotate */}
                    <g className="anton-ring-outer" style={{ transformOrigin: `${cx}px ${cy}px` }}>
                        {spokes.map((angle, i) => {
                            const s = spoke(angle)
                            return (
                                <line
                                    key={`outer-${i}`}
                                    x1={s.x1}
                                    y1={s.y1}
                                    x2={s.x2}
                                    y2={s.y2}
                                    stroke="#cc785c"
                                    strokeWidth={size === "sm" ? 1 : 1.5}
                                    strokeLinecap="round"
                                    opacity="0.18"
                                />
                            )
                        })}
                    </g>

                    {/* main spike group — spins forward */}
                    <g className="anton-ring-main" style={{ transformOrigin: `${cx}px ${cy}px` }}>
                        {spokes.map((angle, i) => {
                            const s = spoke(angle)
                            const len = Math.sqrt(
                                Math.pow(s.x2 - s.x1, 2) + Math.pow(s.y2 - s.y1, 2)
                            )
                            return (
                                <line
                                    key={`main-${i}`}
                                    x1={s.x1}
                                    y1={s.y1}
                                    x2={s.x2}
                                    y2={s.y2}
                                    stroke="#cc785c"
                                    strokeWidth={size === "sm" ? 1.5 : size === "md" ? 2 : 2.5}
                                    strokeLinecap="round"
                                    strokeDasharray={len}
                                    strokeDashoffset={0}
                                    className={`anton-spoke anton-spoke--${i}`}
                                />
                            )
                        })}
                    </g>

                    {/* pulsing center dot */}
                    <circle
                        cx={cx}
                        cy={cy}
                        r={size === "sm" ? 2 : size === "md" ? 3 : 5}
                        fill="#cc785c"
                        className="anton-dot"
                    />
                </svg>
            </div>

            {label && size !== "sm" && (
                <span className={`anton-loader__label anton-loader__label--${size}`}>
                    {label}
                </span>
            )}
        </div>
    )
}