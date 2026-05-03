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
    
    # Pre-calculate token-to-char offsets to avoid O(N^2) decoding
    # This is much faster for large pages
    token_offsets = [0]
    for i in range(len(tokens)):
        token_str = enc.decode([tokens[i]])
        token_offsets.append(token_offsets[-1] + len(token_str))

    start_token_idx = 0
    chunk_idx = 0
    
    while start_token_idx < len(tokens):
        end_token_idx = min(start_token_idx + CHUNK_SIZE, len(tokens))
        chunk_tokens = tokens[start_token_idx:end_token_idx]
        content = enc.decode(chunk_tokens)
        
        chunks.append({
            "content": content,
            "pageNumber": page_number,
            "section": section,
            "chunkIndex": chunk_idx,
            "tokenCount": len(chunk_tokens),
            "startChar": token_offsets[start_token_idx],
            "endChar": token_offsets[end_token_idx],
        })
        
        chunk_idx += 1
        start_token_idx += CHUNK_SIZE - OVERLAP
        if start_token_idx >= len(tokens) and len(tokens) > 0:
            break
            
    return chunks

def parse_pdf(buffer: bytes):
    doc = fitz.open(stream=buffer, filetype="pdf")
    all_chunks = []
    page_count = len(doc)

    try:
        for page in doc:
            text = page.get_text().strip()
            if not text:
                continue
            page_number = page.number + 1
            chunks = chunk_text(text, page_number, "")
            all_chunks.extend(chunks)
    finally:
        doc.close()

    return {"chunks": all_chunks, "pageCount": page_count}