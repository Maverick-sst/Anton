import fitz
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")
CHUNK_SIZE = 300
OVERLAP = 50

def count_tokens(text: str) -> int:
    return len(enc.encode(text))

def chunk_text(text: str, page_number: int, section: str):
    tokens = enc.encode(text)
    chunks = []
    index = 0
    start_token = 0

    while start_token < len(tokens):
        end_token = min(start_token + CHUNK_SIZE, len(tokens))
        chunk_tokens = tokens[start_token:end_token]
        content = enc.decode(chunk_tokens)

        # character offsets relative to page text
        start_char = len(enc.decode(tokens[:start_token]))
        end_char = start_char + len(content)

        chunks.append({
            "content": content,
            "pageNumber": page_number,
            "section": section,
            "chunkIndex": index,
            "tokenCount": len(chunk_tokens),
            "startChar": start_char,
            "endChar": end_char,
        })
        index += 1
        start_token += CHUNK_SIZE - OVERLAP

    return chunks

def parse_pdf(buffer: bytes):
    doc = fitz.open(stream=buffer, filetype="pdf")
    all_chunks = []

    for page in doc:
        text = page.get_text().strip()
        if not text:
            continue
        page_number = page.number + 1
        section = ""
        chunks = chunk_text(text, page_number, section)
        all_chunks.append(chunks)

    flat = [c for page_chunks in all_chunks for c in page_chunks]
    return {"chunks": flat, "pageCount": len(doc)}