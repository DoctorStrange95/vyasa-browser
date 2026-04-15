from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------

class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    RESEARCHER = "researcher"
    ADMIN = "admin"


class ArticleSource(str, enum.Enum):
    PUBMED = "pubmed"
    SCHOLAR = "scholar"
    IDSP = "idsp"           # Integrated Disease Surveillance Programme
    MOHFW = "mohfw"         # Ministry of Health & Family Welfare (India)


class PaperStatus(str, enum.Enum):
    DRAFT = "draft"
    REVIEW = "review"
    PUBLISHED = "published"


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    institution: Mapped[Optional[str]] = mapped_column(String(512))
    password_hash: Mapped[str] = mapped_column(String(256), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"),
        default=UserRole.RESEARCHER,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Refresh-token storage (one active token per user; rotated on every use)
    refresh_token_hash: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True,
        comment="SHA-256 hex digest of the current refresh token"
    )
    refresh_token_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    library: Mapped[list[UserLibrary]] = relationship(
        "UserLibrary", back_populates="user", cascade="all, delete-orphan"
    )
    papers: Mapped[list[Paper]] = relationship(
        "Paper", back_populates="author", cascade="all, delete-orphan"
    )
    datasets: Mapped[list[Dataset]] = relationship(
        "Dataset", back_populates="owner", cascade="all, delete-orphan"
    )
    tags: Mapped[list[Tag]] = relationship(
        "Tag", back_populates="user", cascade="all, delete-orphan"
    )
    collections: Mapped[list[Collection]] = relationship(
        "Collection", back_populates="user", cascade="all, delete-orphan"
    )
    search_history: Mapped[list[SearchHistory]] = relationship(
        "SearchHistory", back_populates="user", cascade="all, delete-orphan"
    )
    reading_sessions: Mapped[list[ReadingSession]] = relationship(
        "ReadingSession", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r} role={self.role}>"


# ---------------------------------------------------------------------------
# Article  (scraped from external sources)
# ---------------------------------------------------------------------------

class Article(Base):
    __tablename__ = "articles"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Core metadata
    title: Mapped[str] = mapped_column(Text, nullable=False)
    abstract: Mapped[Optional[str]] = mapped_column(Text)
    authors: Mapped[Optional[dict]] = mapped_column(
        JSONB, comment='Ordered array of author names, e.g. ["Singh A", "Patel R"]'
    )
    journal: Mapped[Optional[str]] = mapped_column(String(512))
    year: Mapped[Optional[int]] = mapped_column(Integer, index=True)
    volume: Mapped[Optional[str]] = mapped_column(String(64))
    issue: Mapped[Optional[str]] = mapped_column(String(64))
    pages: Mapped[Optional[str]] = mapped_column(String(64))

    # Identifiers & access
    doi: Mapped[Optional[str]] = mapped_column(String(256), unique=True, index=True)
    pmid: Mapped[Optional[str]] = mapped_column(String(64), unique=True, index=True)
    url: Mapped[Optional[str]] = mapped_column(Text)
    full_text_url: Mapped[Optional[str]] = mapped_column(Text)

    # Source & classification
    source: Mapped[ArticleSource] = mapped_column(
        Enum(ArticleSource, name="article_source"), nullable=False, index=True
    )
    disease_category: Mapped[Optional[str]] = mapped_column(String(256), index=True)
    study_type: Mapped[Optional[str]] = mapped_column(
        String(128),
        comment="e.g. RCT, cohort, case-control, systematic-review, surveillance-report"
    )
    geography: Mapped[Optional[str]] = mapped_column(
        String(256),
        comment="Country / region the study covers"
    )
    keywords: Mapped[Optional[dict]] = mapped_column(
        JSONB, comment='Array of keyword strings, e.g. ["dengue", "vector control"]'
    )

    # Timestamps
    scraped_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    indexed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        comment="When the article was pushed to the Elasticsearch index"
    )

    # Relationships
    library_entries: Mapped[list[UserLibrary]] = relationship(
        "UserLibrary", back_populates="article", cascade="all, delete-orphan"
    )
    references: Mapped[list[Reference]] = relationship(
        "Reference", back_populates="article", cascade="all, delete-orphan"
    )
    paper_tags: Mapped[list[PaperTag]] = relationship(
        "PaperTag", back_populates="article", cascade="all, delete-orphan"
    )
    collection_papers: Mapped[list[CollectionPaper]] = relationship(
        "CollectionPaper", back_populates="article", cascade="all, delete-orphan"
    )
    reading_sessions: Mapped[list[ReadingSession]] = relationship(
        "ReadingSession", back_populates="article", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_articles_source_year", "source", "year"),
        Index("ix_articles_disease_category", "disease_category"),
    )

    def __repr__(self) -> str:
        return f"<Article id={self.id} doi={self.doi!r} title={self.title[:60]!r}>"


# ---------------------------------------------------------------------------
# UserLibrary  (saved articles)
# ---------------------------------------------------------------------------

class UserLibrary(Base):
    __tablename__ = "user_library"

    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    article_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text)
    tags: Mapped[Optional[dict]] = mapped_column(
        JSONB, comment='Array of user-defined tag strings, e.g. ["to-read", "dengue"]'
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="library")
    article: Mapped[Article] = relationship("Article", back_populates="library_entries")

    __table_args__ = (
        Index("ix_user_library_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<UserLibrary user_id={self.user_id} article_id={self.article_id}>"


# ---------------------------------------------------------------------------
# Paper  (user-authored manuscripts)
# ---------------------------------------------------------------------------

class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    title: Mapped[str] = mapped_column(Text, nullable=False)
    abstract: Mapped[Optional[str]] = mapped_column(Text)

    # TipTap document stored as JSON
    content: Mapped[Optional[dict]] = mapped_column(
        JSONB, comment="Full TipTap/ProseMirror document JSON"
    )

    status: Mapped[PaperStatus] = mapped_column(
        Enum(PaperStatus, name="paper_status"),
        default=PaperStatus.DRAFT,
        nullable=False,
        index=True,
    )

    # Assigned after publication / DOI minting via Zenodo
    doi: Mapped[Optional[str]] = mapped_column(String(256), unique=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    author: Mapped[User] = relationship("User", back_populates="papers")
    references: Mapped[list[Reference]] = relationship(
        "Reference", back_populates="paper", cascade="all, delete-orphan",
        order_by="Reference.position"
    )
    datasets: Mapped[list[Dataset]] = relationship(
        "Dataset", back_populates="paper"
    )

    def __repr__(self) -> str:
        return f"<Paper id={self.id} status={self.status} title={self.title[:60]!r}>"


# ---------------------------------------------------------------------------
# Reference  (citations inside a Paper that point to an Article)
# ---------------------------------------------------------------------------

class Reference(Base):
    __tablename__ = "references"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    paper_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    article_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True
    )

    citation_style: Mapped[Optional[str]] = mapped_column(
        String(64), comment="e.g. APA, Vancouver, Harvard"
    )
    citation_text: Mapped[Optional[str]] = mapped_column(
        Text, comment="Pre-formatted citation string for the chosen style"
    )
    position: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="Order of this citation in the paper's reference list"
    )

    # Relationships
    paper: Mapped[Paper] = relationship("Paper", back_populates="references")
    article: Mapped[Article] = relationship("Article", back_populates="references")

    __table_args__ = (
        UniqueConstraint("paper_id", "article_id", name="uq_reference_paper_article"),
        Index("ix_references_paper_id", "paper_id"),
    )

    def __repr__(self) -> str:
        return f"<Reference id={self.id} paper_id={self.paper_id} article_id={self.article_id}>"


# ---------------------------------------------------------------------------
# Dataset  (uploaded by users, optionally attached to a Paper)
# ---------------------------------------------------------------------------

class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    paper_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("papers.id", ondelete="SET NULL"), nullable=True, index=True
    )

    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    file_path: Mapped[str] = mapped_column(
        Text, nullable=False, comment="Server-side path or object-storage key"
    )
    columns: Mapped[Optional[dict]] = mapped_column(
        JSONB, comment='Array of column descriptor objects, e.g. [{"name": "age", "dtype": "int64"}]'
    )
    row_count: Mapped[Optional[int]] = mapped_column(Integer)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    owner: Mapped[User] = relationship("User", back_populates="datasets")
    paper: Mapped[Optional[Paper]] = relationship("Paper", back_populates="datasets")
    analysis_results: Mapped[list[AnalysisResult]] = relationship(
        "AnalysisResult", back_populates="dataset", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Dataset id={self.id} filename={self.filename!r} rows={self.row_count}>"


# ---------------------------------------------------------------------------
# AnalysisResult
# ---------------------------------------------------------------------------

class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dataset_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )

    analysis_type: Mapped[str] = mapped_column(
        String(128), nullable=False,
        comment="e.g. descriptive_stats, chi_square, kaplan_meier, linear_regression"
    )
    parameters: Mapped[Optional[dict]] = mapped_column(
        JSONB, comment="Input parameters passed to the analysis function"
    )
    results: Mapped[Optional[dict]] = mapped_column(
        JSONB, comment="Structured output: test statistics, p-values, coefficients, etc."
    )
    chart_data: Mapped[Optional[dict]] = mapped_column(
        JSONB, comment="Vega-Lite / Chart.js spec or raw series data for rendering"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    dataset: Mapped[Dataset] = relationship("Dataset", back_populates="analysis_results")

    def __repr__(self) -> str:
        return (
            f"<AnalysisResult id={self.id} dataset_id={self.dataset_id} "
            f"type={self.analysis_type!r}>"
        )


# ---------------------------------------------------------------------------
# Tag  (user-owned labels applied to articles)
# ---------------------------------------------------------------------------

class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    color: Mapped[Optional[str]] = mapped_column(
        String(7), comment="Hex color code, e.g. #FF5733"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="tags")
    paper_tags: Mapped[list[PaperTag]] = relationship(
        "PaperTag", back_populates="tag", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_tag_user_name"),
        Index("ix_tags_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<Tag id={self.id} user_id={self.user_id} name={self.name!r}>"


# ---------------------------------------------------------------------------
# Collection  (named folders of articles owned by a user)
# ---------------------------------------------------------------------------

class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="collections")
    collection_papers: Mapped[list[CollectionPaper]] = relationship(
        "CollectionPaper", back_populates="collection", cascade="all, delete-orphan",
        order_by="CollectionPaper.position"
    )

    __table_args__ = (
        Index("ix_collections_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<Collection id={self.id} user_id={self.user_id} name={self.name!r}>"


# ---------------------------------------------------------------------------
# CollectionPaper  (join: Collection ↔ Article)
# "Paper" here refers conceptually to a research paper (Article row).
# ---------------------------------------------------------------------------

class CollectionPaper(Base):
    __tablename__ = "collection_papers"

    collection_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True
    )
    article_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True
    )
    position: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False,
        comment="Display order within the collection"
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    collection: Mapped[Collection] = relationship("Collection", back_populates="collection_papers")
    article: Mapped[Article] = relationship("Article", back_populates="collection_papers")

    __table_args__ = (
        Index("ix_collection_papers_collection_id", "collection_id"),
        Index("ix_collection_papers_article_id", "article_id"),
    )

    def __repr__(self) -> str:
        return (
            f"<CollectionPaper collection_id={self.collection_id} "
            f"article_id={self.article_id} pos={self.position}>"
        )


# ---------------------------------------------------------------------------
# PaperTag  (join: Article ↔ Tag)
# Normalized tag ↔ article association scoped per user via Tag.user_id.
# ---------------------------------------------------------------------------

class PaperTag(Base):
    __tablename__ = "paper_tags"

    article_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("articles.id", ondelete="CASCADE"), primary_key=True
    )
    tag_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
    )

    # Relationships
    article: Mapped[Article] = relationship("Article", back_populates="paper_tags")
    tag: Mapped[Tag] = relationship("Tag", back_populates="paper_tags")

    __table_args__ = (
        Index("ix_paper_tags_article_id", "article_id"),
        Index("ix_paper_tags_tag_id", "tag_id"),
    )

    def __repr__(self) -> str:
        return f"<PaperTag article_id={self.article_id} tag_id={self.tag_id}>"


# ---------------------------------------------------------------------------
# SearchHistory  (per-user search query log)
# ---------------------------------------------------------------------------

class SearchHistory(Base):
    __tablename__ = "search_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    filters: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        comment='Active filter state, e.g. {"source": "pubmed", "year_min": 2018, "study_type": "RCT"}'
    )
    source: Mapped[Optional[str]] = mapped_column(
        String(64), comment="Search target, e.g. pubmed, scholar, idsp, all"
    )
    result_count: Mapped[Optional[int]] = mapped_column(
        Integer, comment="Number of results returned for this query"
    )
    searched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="search_history")

    __table_args__ = (
        Index("ix_search_history_user_id", "user_id"),
        Index("ix_search_history_searched_at", "searched_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<SearchHistory id={self.id} user_id={self.user_id} "
            f"query={self.query[:40]!r} at={self.searched_at}>"
        )


# ---------------------------------------------------------------------------
# ReadingSession  (tracks time a user spends reading an article)
# ---------------------------------------------------------------------------

class BurdenSource(str, enum.Enum):
    WHO_GHO  = "who_gho"    # WHO Global Health Observatory
    IHME_GBD = "ihme_gbd"   # Institute for Health Metrics and Evaluation – GBD
    ICMR     = "icmr"       # Indian Council of Medical Research
    NFHS     = "nfhs"       # National Family Health Survey (India)
    IDSP_SUM = "idsp_sum"   # IDSP aggregated weekly summary


# ---------------------------------------------------------------------------
# BurdenRecord  (disease burden metrics from public health databases)
# ---------------------------------------------------------------------------

class BurdenRecord(Base):
    __tablename__ = "burden_records"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Classification
    disease: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    metric: Mapped[str] = mapped_column(
        String(128), nullable=False,
        comment="e.g. DALYs, Deaths, Incidence, Prevalence, YLLs, YLDs, DALY_rate"
    )

    # Geography
    country_code: Mapped[Optional[str]] = mapped_column(
        String(10), index=True, comment="ISO-3 country code, e.g. IND, USA"
    )
    state: Mapped[Optional[str]] = mapped_column(
        String(128), index=True, comment="Sub-national region / Indian state"
    )

    # Temporal
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # Value
    value: Mapped[Optional[float]] = mapped_column(Float)
    lower_ci: Mapped[Optional[float]] = mapped_column(Float, comment="95% UI lower bound")
    upper_ci: Mapped[Optional[float]] = mapped_column(Float, comment="95% UI upper bound")
    unit: Mapped[Optional[str]] = mapped_column(String(64), comment="e.g. per 100 000, count, rate")

    # Age/sex stratification (nullable = all-ages / both-sexes)
    age_group: Mapped[Optional[str]] = mapped_column(String(64))
    sex: Mapped[Optional[str]] = mapped_column(String(16), comment="both | male | female")

    # Provenance
    source: Mapped[BurdenSource] = mapped_column(
        Enum(BurdenSource, name="burden_source"), nullable=False, index=True
    )
    source_indicator: Mapped[Optional[str]] = mapped_column(
        String(128), comment="Original indicator code from the source API"
    )
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_burden_disease_year", "disease", "year"),
        Index("ix_burden_country_disease", "country_code", "disease"),
        Index("ix_burden_source", "source"),
    )

    def __repr__(self) -> str:
        return (
            f"<BurdenRecord id={self.id} disease={self.disease!r} "
            f"metric={self.metric!r} year={self.year} value={self.value}>"
        )


# ---------------------------------------------------------------------------
# PdfDocument  (uploaded PDFs for AI chat)
# ---------------------------------------------------------------------------

class PdfDocument(Base):
    __tablename__ = "pdf_documents"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    paper_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("papers.id", ondelete="SET NULL"), nullable=True, index=True
    )

    filename: Mapped[str] = mapped_column(String(512), nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False, comment="Server-side path")
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, comment="Full text extracted from PDF")
    page_count: Mapped[Optional[int]] = mapped_column(Integer)

    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    owner: Mapped[User] = relationship("User")

    __table_args__ = (
        Index("ix_pdf_documents_user_id", "user_id"),
    )

    def __repr__(self) -> str:
        return f"<PdfDocument id={self.id} filename={self.filename!r} pages={self.page_count}>"


class ReadingSession(Base):
    __tablename__ = "reading_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    article_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("articles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ended_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        comment="NULL until the session is closed or the tab is unloaded"
    )
    duration_seconds: Mapped[Optional[int]] = mapped_column(
        Integer, comment="Computed from ended_at - started_at; may be set client-side"
    )
    scroll_depth: Mapped[Optional[float]] = mapped_column(
        Float, comment="0.0 – 1.0 fraction of article body scrolled"
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text, comment="Inline annotation or highlight captured during this session"
    )

    # Relationships
    user: Mapped[User] = relationship("User", back_populates="reading_sessions")
    article: Mapped[Article] = relationship("Article", back_populates="reading_sessions")

    __table_args__ = (
        Index("ix_reading_sessions_user_id", "user_id"),
        Index("ix_reading_sessions_article_id", "article_id"),
        Index("ix_reading_sessions_started_at", "started_at"),
    )

    def __repr__(self) -> str:
        return (
            f"<ReadingSession id={self.id} user_id={self.user_id} "
            f"article_id={self.article_id} duration={self.duration_seconds}s>"
        )
