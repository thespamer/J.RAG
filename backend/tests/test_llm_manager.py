"""
Tests for the LLMManager class.
"""
import pytest
import torch
from unittest.mock import patch, MagicMock, ANY
from transformers import AutoConfig, AutoTokenizer, PreTrainedTokenizer
from core.llm_manager import LLMManager
from core.memory_manager import MemoryManager
from core.system_manager import SystemManager

class TestLLMManager:
    @pytest.fixture
    def mock_tokenizer(self):
        """Mock tokenizer fixture."""
        tokenizer = MagicMock(spec=PreTrainedTokenizer)
        tokenizer.pad_token_id = 0
        tokenizer.eos_token_id = 2
        tokenizer.encode.return_value = [1, 2, 3]
        tokenizer.decode.return_value = "Test response"
        return tokenizer

    @pytest.fixture
    def mock_model(self):
        """Mock model fixture."""
        model = MagicMock()
        model.device = torch.device("cpu")
        model.generation_config = None
        outputs = MagicMock()
        outputs.sequences = torch.tensor([[1, 2, 3]])
        model.generate.return_value = outputs
        return model

    @pytest.fixture
    def mock_config(self):
        """Mock model config fixture."""
        config = MagicMock(spec=AutoConfig)
        return config

    def test_init(self, clean_test_env):
        """Test LLMManager initialization."""
        memory_manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        system_manager = SystemManager()
        
        manager = LLMManager(memory_manager=memory_manager, system_manager=system_manager)
        assert manager.memory_manager == memory_manager
        assert manager.system_manager == system_manager
        assert manager.model is None
        assert manager.tokenizer is None

    @patch('core.llm_manager.AutoModelForCausalLM')
    @patch('core.llm_manager.AutoTokenizer')
    @patch('core.llm_manager.AutoConfig')
    def test_initialize_model_auto_device(self, mock_auto_config, mock_auto_tokenizer, 
                                       mock_auto_model, clean_test_env, mock_tokenizer, 
                                       mock_model, mock_config):
        """Test model initialization with auto device mapping."""
        # Setup mocks
        mock_auto_config.from_pretrained.return_value = mock_config
        mock_auto_tokenizer.from_pretrained.return_value = mock_tokenizer
        mock_auto_model.from_pretrained.return_value = mock_model
        
        memory_manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        system_manager = SystemManager()
        
        # Initialize manager
        manager = LLMManager(memory_manager=memory_manager, system_manager=system_manager)
        
        # Verify model initialization
        mock_auto_model.from_pretrained.assert_called_once_with(
            ANY,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            trust_remote_code=True,
            low_cpu_mem_usage=True,
            offload_folder=clean_test_env["offload_dir"],
            cache_dir=clean_test_env["cache_dir"],
            max_memory={0: "1GB", "cpu": "2GB"}
        )

    @patch('core.llm_manager.AutoModelForCausalLM')
    @patch('core.llm_manager.AutoTokenizer')
    @patch('core.llm_manager.AutoConfig')
    def test_initialize_model_disk_fallback(self, mock_auto_config, mock_auto_tokenizer, 
                                         mock_auto_model, clean_test_env, mock_tokenizer, 
                                         mock_model, mock_config):
        """Test model initialization with disk fallback."""
        # Setup mocks
        mock_auto_config.from_pretrained.return_value = mock_config
        mock_auto_tokenizer.from_pretrained.return_value = mock_tokenizer
        # Make first attempt fail
        mock_auto_model.from_pretrained.side_effect = [
            RuntimeError("GPU memory error"),
            mock_model
        ]
        
        memory_manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        system_manager = SystemManager()
        
        # Initialize manager
        manager = LLMManager(memory_manager=memory_manager, system_manager=system_manager)
        
        # Verify disk fallback was attempted
        assert mock_auto_model.from_pretrained.call_count == 2
        mock_auto_model.from_pretrained.assert_called_with(
            ANY,
            config=mock_config,
            device_map="disk",
            torch_dtype=torch.bfloat16,
            trust_remote_code=True,
            low_cpu_mem_usage=True,
            offload_folder=clean_test_env["offload_dir"],
            max_memory={"cpu": "2GB"}
        )

    def test_verify_model_files(self, clean_test_env, mock_model_files):
        """Test model files verification."""
        memory_manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        manager = LLMManager(memory_manager=memory_manager)
        
        # Test with valid files
        assert manager.verify_model_files(mock_model_files) is True
        
        # Test with missing file
        import os
        os.remove(os.path.join(mock_model_files, "config.json"))
        assert manager.verify_model_files(mock_model_files) is False

    def test_generate_response(self, clean_test_env, mock_tokenizer, mock_model):
        """Test response generation."""
        manager = LLMManager()
        manager.model = mock_model
        manager.tokenizer = mock_tokenizer
        
        # Test normal generation
        response = manager.generate_response("Test input")
        assert response == "Test response"
        
        # Test with context
        context = {"history": "Previous conversation"}
        response = manager.generate_response("Test input", context)
        assert response == "Test response"
        
        # Test error handling
        mock_model.generate.side_effect = RuntimeError("Generation error")
        response = manager.generate_response("Test input")
        assert "Error" in response

    def test_error_handling(self, clean_test_env):
        """Test error handling in model initialization."""
        memory_manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        system_manager = SystemManager()
        
        with patch('core.llm_manager.AutoModelForCausalLM.from_pretrained') as mock_model:
            mock_model.side_effect = Exception("Model loading error")
            
            manager = LLMManager(memory_manager=memory_manager, system_manager=system_manager)
            assert manager.model is None
            assert system_manager.get_model_status()["status"] == "error"

    @patch('core.llm_manager.AutoModelForCausalLM')
    @patch('core.llm_manager.AutoTokenizer')
    def test_model_offloading(self, mock_auto_tokenizer, mock_auto_model, 
                            clean_test_env, mock_tokenizer, mock_model):
        """Test model offloading functionality."""
        memory_manager = MemoryManager(
            cache_dir=clean_test_env["cache_dir"],
            offload_dir=clean_test_env["offload_dir"]
        )
        
        # Setup mock for disk offload
        mock_auto_tokenizer.from_pretrained.return_value = mock_tokenizer
        mock_auto_model.from_pretrained.return_value = mock_model
        
        manager = LLMManager(memory_manager=memory_manager)
        
        # Verify offload directory was used
        mock_auto_model.from_pretrained.assert_called_with(
            ANY,
            offload_folder=clean_test_env["offload_dir"],
            ANY
        )

    def test_download_progress_callback(self, clean_test_env):
        """Test download progress callback."""
        system_manager = SystemManager()
        manager = LLMManager(system_manager=system_manager)
        
        # Test progress updates
        manager._download_progress_callback(50.0)
        status = system_manager.get_model_status()
        assert status["status"] == "downloading"
        assert status["download_progress"] == 50.0
