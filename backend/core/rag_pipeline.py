from typing import List, Dict, Any
import os
import psutil
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.document_loaders import (
    PyPDFLoader,
    TextLoader,
    Docx2txtLoader,
    UnstructuredFileLoader
)

class RAGPipeline:
    def __init__(self):
        self.encoder = SentenceTransformer('all-MiniLM-L6-v2')
        self.index = None
        self.documents = []
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200
        )
        self.documents_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'documents')
        os.makedirs(self.documents_dir, exist_ok=True)
        
    def check_system_resources(self, file_size: int) -> tuple[bool, str]:
        """Check if system has enough resources to process file"""
        # Check available memory
        mem = psutil.virtual_memory()
        if mem.available < 512 * 1024 * 1024:  # 512MB
            return False, "Insufficient memory. At least 512MB required."
            
        # Check available disk space in documents directory
        disk = psutil.disk_usage(self.documents_dir)
        if disk.free < 1024 * 1024 * 1024:  # 1GB
            return False, "Insufficient disk space. At least 1GB required."
            
        # Check if file size is reasonable
        if file_size > 10 * 1024 * 1024:  # 10MB
            return False, "File too large. Maximum size is 10MB."
            
        return True, ""
        
    def process_documents(self, files: List[Any]) -> Dict[str, Any]:
        """Process multiple documents"""
        results = {
            'success': [],
            'errors': []
        }
        
        for file in files:
            # Check file size and system resources
            file_size = len(file.read())
            file.seek(0)  # Reset file pointer
            
            can_process, error = self.check_system_resources(file_size)
            if not can_process:
                results['errors'].append({
                    'file': file.filename,
                    'error': error
                })
                continue
                
            try:
                # Save file temporarily
                temp_path = os.path.join(self.documents_dir, file.filename)
                file.save(temp_path)
                
                # Process document
                chunks = self.process_document(temp_path)
                self.update_index()
                
                results['success'].append({
                    'file': file.filename,
                    'chunks': len(chunks)
                })
                
            except Exception as e:
                results['errors'].append({
                    'file': file.filename,
                    'error': str(e)
                })
                
            finally:
                # Cleanup temporary file
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                    
        return results
        
    def process_document(self, file_path: str) -> List[Dict[str, Any]]:
        """Process a document and return chunks"""
        # Select loader based on file extension
        if file_path.endswith('.pdf'):
            loader = PyPDFLoader(file_path)
        elif file_path.endswith('.txt'):
            loader = TextLoader(file_path)
        elif file_path.endswith('.docx'):
            loader = Docx2txtLoader(file_path)
        else:
            loader = UnstructuredFileLoader(file_path)
            
        # Load and split document
        doc = loader.load()
        chunks = self.text_splitter.split_documents(doc)
        
        # Store document chunks
        processed_chunks = []
        for i, chunk in enumerate(chunks):
            processed_chunks.append({
                'id': len(self.documents) + i,
                'text': chunk.page_content,
                'metadata': chunk.metadata
            })
        
        self.documents.extend(processed_chunks)
        return processed_chunks
        
    def update_index(self):
        """Update FAISS index with all documents"""
        if not self.documents:
            return
            
        # Get embeddings for all documents
        texts = [doc['text'] for doc in self.documents]
        embeddings = self.encoder.encode(texts)
        
        # Create and populate FAISS index
        dimension = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(np.array(embeddings).astype('float32'))
        
    def query(self, query_text: str, k: int = 3) -> List[Dict[str, Any]]:
        """Query the RAG pipeline"""
        if not self.index:
            return []
            
        # Get query embedding
        query_embedding = self.encoder.encode([query_text])[0]
        
        # Search in FAISS
        D, I = self.index.search(
            np.array([query_embedding]).astype('float32'), 
            k
        )
        
        # Return relevant documents
        results = []
        for i, idx in enumerate(I[0]):
            if idx < len(self.documents):
                doc = self.documents[idx]
                results.append({
                    'text': doc['text'],
                    'metadata': doc['metadata'],
                    'score': float(D[0][i])
                })
                
        return results
