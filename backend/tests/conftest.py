"""
Test configuration and fixtures for Q-RAG3 backend tests.
"""
import os
import pytest
import tempfile
import shutil
from pathlib import Path

@pytest.fixture(scope="session")
def test_data_dir():
    """Create a temporary directory for test data."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture(scope="session")
def test_cache_dir():
    """Create a temporary directory for test cache."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture(scope="session")
def test_offload_dir():
    """Create a temporary directory for model offloading."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    shutil.rmtree(temp_dir)

@pytest.fixture(scope="function")
def mock_model_files(test_data_dir):
    """Create mock model files for testing."""
    model_dir = Path(test_data_dir) / "mock_model"
    model_dir.mkdir(exist_ok=True)
    
    # Create mock config files
    files = {
        "config.json": "{}",
        "tokenizer_config.json": "{}",
        "tokenizer.json": "{" + "x" * 1024 * 1024 + "}",  # 1MB file
        "special_tokens_map.json": "{}",
        "generation_config.json": "{}"
    }
    
    for filename, content in files.items():
        with open(model_dir / filename, "w") as f:
            f.write(content)
    
    # Create mock model weights
    with open(model_dir / "model.safetensors", "wb") as f:
        f.write(b"x" * (7 * 1024 * 1024 * 1024))  # 7GB file
    
    yield str(model_dir)
    shutil.rmtree(model_dir)

@pytest.fixture(scope="function")
def clean_test_env(test_data_dir, test_cache_dir, test_offload_dir):
    """Provide clean test directories and environment variables."""
    original_env = dict(os.environ)
    
    os.environ.update({
        "MODEL_CACHE_DIR": test_cache_dir,
        "MODEL_OFFLOAD_DIR": test_offload_dir,
        "DATA_DIR": test_data_dir
    })
    
    yield {
        "cache_dir": test_cache_dir,
        "offload_dir": test_offload_dir,
        "data_dir": test_data_dir
    }
    
    os.environ.clear()
    os.environ.update(original_env)
