import "./CitationBadge.css"

type Props = {
  page: number
}

export default function CitationBadge({ page }: Props) {
  return <span className="citation-badge">Page {page}</span>
}
