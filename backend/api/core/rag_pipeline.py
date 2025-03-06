import os
from typing import List, Dict, Any
from PyPDF2 import PdfReader
from docx import Document
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import numpy as np
import faiss
import torch
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RAGPipeline:
    def __init__(self):
        logger.info("Initializing RAGPipeline")
        self.documents = {}
        self.chunks = {}
        self.embeddings = None
        self.index = None
        self.model = None
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len
        )
        
    def _load_model(self):
        if self.model is None:
            logger.info("Loading SentenceTransformer model")
            try:
                model_name = "all-MiniLM-L6-v2"
                device = "cuda" if torch.cuda.is_available() else "cpu"
                logger.info(f"Using device: {device}")
                self.model = SentenceTransformer(model_name, device=device)
                logger.info("Model loaded successfully")
            except Exception as e:
                logger.error(f"Error loading model: {str(e)}")
                raise
    
    def _extract_text_from_pdf(self, file_path: str) -> str:
        logger.info(f"Extracting text from PDF: {file_path}")
        try:
            with open(file_path, 'rb') as file:
                reader = PdfReader(file)
                text = ""
                for page in reader.pages:
                    text += page.extract_text() + "\n"
                logger.info(f"Successfully extracted {len(text)} characters from PDF")
                return text
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {str(e)}")
            raise
    
    def _extract_text_from_docx(self, file_path: str) -> str:
        logger.info(f"Extracting text from DOCX: {file_path}")
        try:
            doc = Document(file_path)
            text = ""
            for paragraph in doc.paragraphs:
                text += paragraph.text + "\n"
            logger.info(f"Successfully extracted {len(text)} characters from DOCX")
            return text
        except Exception as e:
            logger.error(f"Error extracting text from DOCX: {str(e)}")
            raise
    
    def _extract_text(self, file_path: str) -> str:
        logger.info(f"Extracting text from: {file_path}")
        try:
            ext = os.path.splitext(file_path)[1].lower()
            if ext == '.pdf':
                return self._extract_text_from_pdf(file_path)
            elif ext in ['.docx', '.doc']:
                return self._extract_text_from_docx(file_path)
            elif ext == '.txt':
                with open(file_path, 'r', encoding='utf-8') as file:
                    text = file.read()
                    logger.info(f"Successfully extracted {len(text)} characters from TXT")
                    return text
            else:
                msg = f"Unsupported file type: {ext}"
                logger.error(msg)
                raise ValueError(msg)
        except Exception as e:
            logger.error(f"Error in _extract_text: {str(e)}")
            raise
    
    def _create_chunks(self, text: str) -> List[str]:
        logger.info(f"Creating chunks from text of length {len(text)}")
        try:
            chunks = self.text_splitter.split_text(text)
            logger.info(f"Created {len(chunks)} chunks")
            return chunks
        except Exception as e:
            logger.error(f"Error creating chunks: {str(e)}")
            raise
    
    def _compute_embeddings(self, chunks: List[str]) -> np.ndarray:
        logger.info(f"Computing embeddings for {len(chunks)} chunks")
        try:
            self._load_model()
            embeddings = self.model.encode(chunks, convert_to_tensor=True)
            logger.info(f"Successfully computed embeddings with shape {embeddings.shape}")
            return embeddings
        except Exception as e:
            logger.error(f"Error computing embeddings: {str(e)}")
            raise
    
    def _update_index(self):
        logger.info("Updating FAISS index")
        try:
            if not self.chunks:
                logger.info("No chunks to index")
                return
                
            all_chunks = []
            for doc_chunks in self.chunks.values():
                all_chunks.extend(doc_chunks)
                
            embeddings = self._compute_embeddings(all_chunks)
            dimension = embeddings.shape[1]
            
            if self.index is None:
                logger.info(f"Creating new FAISS index with dimension {dimension}")
                self.index = faiss.IndexFlatL2(dimension)
                
            if isinstance(embeddings, torch.Tensor):
                embeddings = embeddings.cpu().numpy()
                
            self.index.add(embeddings)
            self.embeddings = embeddings
            logger.info("Successfully updated index")
        except Exception as e:
            logger.error(f"Error updating index: {str(e)}")
            raise
    
    def process_documents(self, files) -> List[Dict[str, Any]]:
        logger.info(f"Processing {len(files)} documents")
        processed = []
        
        for file in files:
            try:
                # Log file info
                logger.info(f"Processing file: {file.filename}")
                logger.info(f"File object type: {type(file)}")
                
                # Salvar o arquivo
                filename = file.filename
                filepath = os.path.join('uploads', filename)
                logger.info(f"Saving file to: {filepath}")
                
                # Criar diretório se não existir
                os.makedirs('uploads', exist_ok=True)
                
                # Salvar arquivo
                file.save(filepath)
                logger.info(f"File saved successfully: {filepath}")
                
                # Extrair texto
                text = self._extract_text(filepath)
                logger.info(f"Extracted {len(text)} characters of text")
                
                # Criar chunks
                doc_chunks = self._create_chunks(text)
                logger.info(f"Created {len(doc_chunks)} chunks")
                
                # Armazenar documento e chunks
                doc_id = len(self.documents) + 1
                self.documents[doc_id] = {
                    'id': doc_id,
                    'name': filename,
                    'path': filepath,
                    'status': 'processed'
                }
                self.chunks[doc_id] = doc_chunks
                
                processed.append(self.documents[doc_id])
                logger.info(f"Document {filename} processed successfully")
                
                # Atualizar índice
                self._update_index()
                
            except Exception as e:
                logger.error(f"Error processing document {file.filename}: {str(e)}")
                logger.exception("Full traceback:")
                processed.append({
                    'name': file.filename,
                    'status': 'error',
                    'error': str(e)
                })
                
        return processed
    
    def query(self, query_text: str, top_k: int = 5) -> Dict[str, Any]:
        logger.info(f"Querying with text: {query_text}")
        if not self.index or not self.chunks:
            logger.warning("No documents indexed")
            return {
                'results': [],
                'query': query_text,
                'status': 'error',
                'error': 'No documents indexed'
            }
            
        try:
            # Computar embedding da query
            query_embedding = self._compute_embeddings([query_text])
            if isinstance(query_embedding, torch.Tensor):
                query_embedding = query_embedding.cpu().numpy()
                
            # Buscar chunks mais similares
            D, I = self.index.search(query_embedding, top_k)
            
            # Mapear resultados
            results = []
            all_chunks = []
            for doc_chunks in self.chunks.values():
                all_chunks.extend(doc_chunks)
                
            for i, (distance, idx) in enumerate(zip(D[0], I[0])):
                if idx < len(all_chunks):
                    results.append({
                        'chunk': all_chunks[idx],
                        'score': float(1 / (1 + distance)),
                        'rank': i + 1
                    })
            
            logger.info(f"Found {len(results)} results")
            return {
                'results': results,
                'query': query_text,
                'status': 'completed'
            }
            
        except Exception as e:
            logger.error(f"Error querying: {str(e)}")
            logger.exception("Full traceback:")
            return {
                'results': [],
                'query': query_text,
                'status': 'error',
                'error': str(e)
            }
